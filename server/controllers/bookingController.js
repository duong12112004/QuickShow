import stripe from "stripe";
import { inngest } from "../inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import {
    BOOKING_STATUS,
    PAYMENT_HOLD_MINUTES,
    PAYMENT_STATUS,
    STATUS_ACTOR,
    appendBookingHistory,
    buildBookingSnapshot,
    createBookingCode
} from "../services/bookingService.js";
import { getPaidSeatCount, getShowtimeLifecycle, SHOWTIME_STATUS } from "../services/showtimeService.js";

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

export const createBooking = async (req, res) => {
    try {
        const userId = ensureAuthenticatedUser(req);
        const { showId, selectedSeats } = req.body;
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
        const snapshot = buildBookingSnapshot({
            showData,
            userId,
            selectedSeats: normalizedSeats,
            bookingCode
        });

        const booking = await Booking.create({
            ...snapshot,
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

        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/loading/my-bookings?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/my-bookings`,
            line_items: [{
                price_data: {
                    currency: "vnd",
                    product_data: {
                        name: `${showData.movie.title} - Mã vé ${booking.bookingCode}`
                    },
                    unit_amount: Math.floor(booking.amount)
                },
                quantity: 1
            }],
            mode: "payment",
            metadata: { bookingId: booking._id.toString(), bookingCode: booking.bookingCode },
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
            expiresAt: booking.expiresAt
        });
    } catch (error) {
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
