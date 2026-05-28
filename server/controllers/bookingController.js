import stripe from "stripe";
import { inngest } from "../inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import {
    BOOKING_STATUS,
    PAYMENT_HOLD_MINUTES,
    PAYMENT_PROVIDER,
    PAYMENT_STATUS,
    STATUS_ACTOR,
    appendBookingHistory,
    buildBookingSnapshot,
    confirmBookingPaid,
    createBookingCode,
    markBookingAsCancelled,
    releaseSeats
} from "../services/bookingService.js";
import { createZaloPayPayment } from "../services/zalopayService.js";
import { getPaidSeatCount, getShowtimeLifecycle, SHOWTIME_STATUS } from "../services/showtimeService.js";
import { debitWallet, getOrCreateWallet, reverseWalletDebit } from "../services/walletService.js";

const getBookableShowtime = async (showId) => {
    const showData = await Show.findById(showId).populate("movie").populate("room");

    if (!showData || !showData.room || !showData.movie) {
        throw new Error("Lỗi truy xuất dữ liệu suất chiếu hoặc phòng chiếu.");
    }

    if ((showData.status || SHOWTIME_STATUS.SCHEDULED) !== SHOWTIME_STATUS.SCHEDULED) {
        throw new Error("Suất chiếu này không còn mở bán.");
    }

    if (showData.room.status && showData.room.status !== "ACTIVE") {
        throw new Error("Phòng chiếu hiện không khả dụng.");
    }

    if (getShowtimeLifecycle(showData) !== "UPCOMING") {
        throw new Error("Đã qua thời gian đặt vé cho suất chiếu này.");
    }

    return showData;
};

const ensureAuthenticatedUser = (req) => {
    const auth = req.auth?.();
    const userId = auth?.userId;

    if (!userId) {
        throw new Error("Vui lòng đăng nhập để tiếp tục.");
    }

    return userId;
};

const generateUniqueBookingCode = async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const bookingCode = createBookingCode();
        const exists = await Booking.exists({ bookingCode });

        if (!exists) {
            return bookingCode;
        }
    }

    throw new Error("Không thể tạo mã đặt vé. Vui lòng thử lại.");
};

const validateSelectedSeats = (selectedSeats) => {
    if (!Array.isArray(selectedSeats) || selectedSeats.length === 0) {
        throw new Error("Vui lòng chọn ít nhất một ghế.");
    }

    if (selectedSeats.length > 5) {
        throw new Error("Bạn chỉ có thể đặt tối đa 5 ghế trong một lần giao dịch.");
    }

    const normalizedSeats = selectedSeats.map((seat) => `${seat}`.trim()).filter(Boolean);

    if (normalizedSeats.length !== selectedSeats.length) {
        throw new Error("Danh sách ghế không hợp lệ.");
    }

    if (new Set(normalizedSeats).size !== normalizedSeats.length) {
        throw new Error("Danh sách ghế đang bị trùng lặp.");
    }

    return normalizedSeats;
};

const checkSeatsAvailability = async (showId, selectedSeats) => {
    try {
        const showData = await getBookableShowtime(showId);

        return !selectedSeats.some((seat) =>
            showData.occupiedSeats?.[seat] || showData.heldSeats?.[seat]
        );
    } catch (error) {
        return false;
    }
};

const getSeatTypeLabel = (seatType) => {
    if (seatType === "VIP") return "Ghế VIP";
    if (seatType === "COUPLE") return "Ghế đôi";
    return "Ghế tiêu chuẩn";
};

const formatCheckoutDateTime = (value) => (
    value
        ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
        : "Chưa có dữ liệu"
);

const trimStripeText = (value, maxLength = 450) => {
    const text = `${value || ""}`.trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
};

const buildCheckoutLineItems = (booking) => {
    const lineItems = [];
    const seatGroups = new Map();

    (booking.seatDetails || []).forEach((seat) => {
        const key = `${seat.seatType}-${seat.unitPrice}`;
        const current = seatGroups.get(key) || {
            seatType: seat.seatType,
            unitPrice: seat.unitPrice,
            seats: []
        };

        current.seats.push(seat.seatNumber);
        seatGroups.set(key, current);
    });

    seatGroups.forEach((group) => {
        if (group.unitPrice <= 0 || group.seats.length === 0) return;

        lineItems.push({
            price_data: {
                currency: "vnd",
                product_data: {
                    name: `${getSeatTypeLabel(group.seatType)} - ${booking.movieTitle}`,
                    description: trimStripeText([
                        `Mã booking: ${booking.bookingCode}`,
                        `Phòng: ${booking.roomName}`,
                        `Suất chiếu: ${formatCheckoutDateTime(booking.showDateTime)}`,
                        `Ghế: ${group.seats.join(", ")}`
                    ].join(" | "))
                },
                unit_amount: Math.floor(group.unitPrice)
            },
            quantity: group.seats.length
        });
    });

    (booking.concessionItems || []).forEach((item) => {
        if (item.unitPrice <= 0 || item.quantity <= 0) return;

        lineItems.push({
            price_data: {
                currency: "vnd",
                product_data: {
                    name: `Combo bắp nước - ${item.name}`,
                    description: trimStripeText(`Mua kèm booking ${booking.bookingCode}`)
                },
                unit_amount: Math.floor(item.unitPrice)
            },
            quantity: item.quantity
        });
    });

    return lineItems;
};

const normalizePaymentProvider = (value) => {
    const normalized = `${value || ""}`.trim().toUpperCase();

    if (normalized === "ZALOPAY" || normalized === PAYMENT_PROVIDER.ZALOPAY_TEST) {
        return PAYMENT_PROVIDER.ZALOPAY_TEST;
    }

    return PAYMENT_PROVIDER.STRIPE_TEST;
};

export const createBooking = async (req, res) => {
    let booking = null;
    let debitedWalletAmount = 0;

    try {
        const userId = ensureAuthenticatedUser(req);
        const { showId, selectedSeats, concessions = [], useWallet = false } = req.body;
        const selectedPaymentProvider = normalizePaymentProvider(req.body?.paymentProvider);
        const { origin } = req.headers;

        const normalizedSeats = validateSelectedSeats(selectedSeats);
        const isAvailable = await checkSeatsAvailability(showId, normalizedSeats);

        if (!isAvailable) {
            return res.json({
                success: false,
                message: "Ghế bạn chọn đã có người đặt, đang được giữ hoặc suất chiếu không còn khả dụng."
            });
        }

        const showData = await getBookableShowtime(showId);
        const bookingCode = await generateUniqueBookingCode();
        const snapshot = await buildBookingSnapshot({
            showData,
            userId,
            selectedSeats: normalizedSeats,
            bookingCode,
            selectedConcessions: concessions
        });
        const wallet = useWallet ? await getOrCreateWallet(userId) : null;
        const walletAmountUsed = useWallet ? Math.min(wallet?.balance || 0, snapshot.amount) : 0;
        const stripeAmount = Math.max(snapshot.amount - walletAmountUsed, 0);

        booking = await Booking.create({
            ...snapshot,
            paymentProvider: selectedPaymentProvider,
            walletAmountUsed,
            stripeAmount,
            bookingStatus: BOOKING_STATUS.PENDING_PAYMENT,
            paymentStatus: PAYMENT_STATUS.UNPAID,
            statusHistory: [{
                status: BOOKING_STATUS.PENDING_PAYMENT,
                paymentStatus: PAYMENT_STATUS.UNPAID,
                actor: STATUS_ACTOR.USER,
                note: "Người dùng tạo đơn và chuyển sang bước thanh toán."
            }]
        });

        normalizedSeats.forEach((seat) => {
            showData.heldSeats[seat] = userId;
        });
        showData.markModified("heldSeats");
        await showData.save();

        if (walletAmountUsed > 0) {
            await debitWallet({
                userId,
                bookingId: booking._id,
                amount: walletAmountUsed,
                note: `Thanh toán booking ${booking.bookingCode} bằng ví QuickShow.`,
                metadata: {
                    bookingCode: booking.bookingCode,
                    showId: showData._id.toString()
                }
            });
            debitedWalletAmount = walletAmountUsed;
            appendBookingHistory(booking, {
                status: booking.bookingStatus,
                paymentStatus: booking.paymentStatus,
                actor: STATUS_ACTOR.USER,
                note: `Đã dùng ${walletAmountUsed.toLocaleString("vi-VN")} VND từ ví QuickShow.`
            });
        }

        if (stripeAmount <= 0) {
            await confirmBookingPaid(booking, {
                actor: STATUS_ACTOR.SYSTEM,
                note: "Booking được thanh toán toàn bộ bằng ví QuickShow."
            });

            await inngest.send({
                name: "app/show.booked",
                data: { bookingId: booking._id.toString() }
            });

            const io = req.app.get("io");
            if (io) {
                io.to(showData._id.toString()).emit("seats_booked_successfully", booking.bookedSeats);
            }

            return res.json({
                success: true,
                paidWithWallet: true,
                bookingCode: booking.bookingCode,
                walletAmountUsed,
                stripeAmount: 0,
                expiresAt: null
            });
        }

        if (selectedPaymentProvider === PAYMENT_PROVIDER.ZALOPAY_TEST) {
            const zalopayPayment = await createZaloPayPayment({
                booking,
                amount: stripeAmount,
                appUser: userId
            });

            booking.paymentLink = zalopayPayment.order_url;
            booking.zalopayAppTransId = zalopayPayment.appTransId;
            booking.zalopayZpTransToken = zalopayPayment.zp_trans_token || "";
            booking.zalopayOrderToken = zalopayPayment.order_token || "";
            booking.zalopayQrCode = zalopayPayment.qr_code || "";
            booking.zalopayReturnCode = Number(zalopayPayment.return_code);
            booking.zalopayReturnMessage = zalopayPayment.return_message || "";
            booking.zalopayRawResponse = zalopayPayment;
            appendBookingHistory(booking, {
                status: booking.bookingStatus,
                paymentStatus: booking.paymentStatus,
                actor: STATUS_ACTOR.SYSTEM,
                note: `Tao phien thanh toan ZaloPay, het han sau ${PAYMENT_HOLD_MINUTES} phut.`
            });
            await booking.save();

            await inngest.send({
                name: "app/checkpayment",
                data: {
                    bookingId: booking._id.toString(),
                    expiresAt: booking.expiresAt.toISOString()
                }
            });

            return res.json({
                success: true,
                url: zalopayPayment.order_url,
                bookingCode: booking.bookingCode,
                walletAmountUsed,
                stripeAmount,
                paymentProvider: selectedPaymentProvider,
                expiresAt: booking.expiresAt
            });
        }

        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
        const lineItems = buildCheckoutLineItems(booking);
        const walletDiscount = walletAmountUsed > 0
            ? await stripeInstance.coupons.create({
                amount_off: Math.floor(walletAmountUsed),
                currency: "vnd",
                duration: "once",
                name: `Ví QuickShow - ${booking.bookingCode}`
            })
            : null;

        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/loading/my-bookings?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/my-bookings`,
            line_items: lineItems,
            mode: "payment",
            client_reference_id: booking.bookingCode,
            discounts: walletDiscount ? [{ coupon: walletDiscount.id }] : undefined,
            metadata: {
                bookingId: booking._id.toString(),
                bookingCode: booking.bookingCode,
                walletAmountUsed: `${walletAmountUsed}`,
                stripeAmount: `${stripeAmount}`
            },
            expires_at: Math.floor(booking.expiresAt.getTime() / 1000)
        });

        booking.paymentLink = session.url;
        booking.stripeSessionId = session.id;
        appendBookingHistory(booking, {
            status: booking.bookingStatus,
            paymentStatus: booking.paymentStatus,
            actor: STATUS_ACTOR.SYSTEM,
            note: `Tạo phiên thanh toán Stripe, hết hạn sau ${PAYMENT_HOLD_MINUTES} phút.`
        });
        await booking.save();

        await inngest.send({
            name: "app/checkpayment",
            data: {
                bookingId: booking._id.toString(),
                expiresAt: booking.expiresAt.toISOString()
            }
        });

        res.json({
            success: true,
            url: session.url,
            bookingCode: booking.bookingCode,
            walletAmountUsed,
            stripeAmount,
            paymentProvider: selectedPaymentProvider,
            expiresAt: booking.expiresAt
        });
    } catch (error) {
        if (booking) {
            try {
                if (debitedWalletAmount > 0) {
                    await reverseWalletDebit({
                        userId: booking.user,
                        bookingId: booking._id,
                        amount: debitedWalletAmount,
                        note: `Hoàn lại ví do tạo booking ${booking.bookingCode} thất bại.`,
                        metadata: { bookingCode: booking.bookingCode }
                    });
                }

                await releaseSeats(booking.show, booking.bookedSeats, {
                    fromHeld: true,
                    fromOccupied: false
                });

                markBookingAsCancelled(booking, {
                    actor: STATUS_ACTOR.SYSTEM,
                    cancelledBy: "SYSTEM",
                    reason: `Tạo booking thất bại: ${error.message}`
                });
                await booking.save();
            } catch (cleanupError) {
                console.error("Không thể rollback booking thất bại:", cleanupError.message);
            }
        }

        console.log(error.message);
        res.json({
            success: false,
            message: "Đã xảy ra lỗi trong quá trình đặt vé: " + error.message
        });
    }
};

export const getOccupiedSeats = async (req, res) => {
    try {
        const { showId } = req.params;
        const showData = await Show.findById(showId);

        if (!showData) {
            return res.json({ success: false, message: "Suất chiếu không tồn tại." });
        }

        if ((showData.status || SHOWTIME_STATUS.SCHEDULED) !== SHOWTIME_STATUS.SCHEDULED) {
            return res.json({ success: false, message: "Suất chiếu này không còn mở bán." });
        }

        const occupiedSeats = Object.keys(showData.occupiedSeats || {});
        res.json({
            success: true,
            occupiedSeats,
            soldSeatCount: getPaidSeatCount(showData)
        });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: "Lỗi khi lấy dữ liệu ghế ngồi: " + error.message });
    }
};
