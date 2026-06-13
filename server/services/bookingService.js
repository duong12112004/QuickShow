import Stripe from "stripe";
import crypto from "crypto";
import Show from "../models/Show.js";
import Concession, { CONCESSION_STATUS } from "../models/Concession.js";
import { getShowtimeLifecycle } from "./showtimeService.js";
import { creditWallet, reverseWalletDebit } from "./walletService.js";

// Trạng thái nghiệp vụ mô tả vòng đời của một booking.
export const BOOKING_STATUS = {
    PENDING_PAYMENT: "PENDING_PAYMENT",
    CONFIRMED: "CONFIRMED",
    CHECKED_IN: "CHECKED_IN",
    CANCELLED: "CANCELLED",
    PAYMENT_EXPIRED: "PAYMENT_EXPIRED",
    REFUND_PENDING: "REFUND_PENDING",
    REFUNDED: "REFUNDED",
    NO_SHOW: "NO_SHOW"
};

// Trạng thái riêng của khoản thanh toán/hoàn tiền.
export const PAYMENT_STATUS = {
    UNPAID: "UNPAID",
    PAID: "PAID",
    EXPIRED: "EXPIRED",
    REFUND_PENDING: "REFUND_PENDING",
    REFUNDED: "REFUNDED",
    REFUND_FAILED: "REFUND_FAILED"
};

// Các cổng thanh toán được hệ thống hỗ trợ.
export const PAYMENT_PROVIDER = {
    STRIPE_TEST: "STRIPE_TEST",
    ZALOPAY_TEST: "ZALOPAY_TEST"
};

// Nơi khách nhận tiền hoàn.
export const REFUND_METHOD = {
    STRIPE: "STRIPE",
    WALLET: "WALLET",
    MIXED: "MIXED"
};

// Tác nhân gây ra một lần thay đổi trạng thái để ghi lịch sử.
export const STATUS_ACTOR = {
    USER: "USER",
    ADMIN: "ADMIN",
    SYSTEM: "SYSTEM",
    STRIPE: "STRIPE",
    ZALOPAY: "ZALOPAY"
};

// Mỗi cổng thanh toán có thời gian giữ ghế khác nhau.
export const STRIPE_PAYMENT_HOLD_MINUTES = 30;
export const ZALOPAY_PAYMENT_HOLD_MINUTES = 10;
export const PAYMENT_HOLD_MINUTES = STRIPE_PAYMENT_HOLD_MINUTES;
export const getPaymentHoldMinutes = (paymentProvider = PAYMENT_PROVIDER.STRIPE_TEST) => (
    paymentProvider === PAYMENT_PROVIDER.ZALOPAY_TEST
        ? ZALOPAY_PAYMENT_HOLD_MINUTES
        : STRIPE_PAYMENT_HOLD_MINUTES
);
export const USER_CANCELLATION_NOTICE_HOURS = 24;
export const USER_REFUND_RATE = 0.8;
export const FULL_REFUND_RATE = 1;
export const CHECK_IN_EARLY_WINDOW_MINUTES = 120;
export const QR_TOKEN_PREFIX = "qsqr.v1";

// Công thức tính giá theo loại ghế từ giá cơ sở của suất chiếu.
const STRIPE_SEAT_TYPE_PRICING = {
    STANDARD: (basePrice) => basePrice,
    VIP: (basePrice) => basePrice + 20000,
    COUPLE: (basePrice) => basePrice * 2
};

const MAX_CONCESSION_PER_ITEM = 3;
const MAX_CONCESSION_TOTAL = 10;

// Tạo mã booking dễ tra cứu từ thời gian và chuỗi ngẫu nhiên.
export const createBookingCode = () => {
    const timestamp = Date.now().toString().slice(-6);
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `QS${timestamp}${randomPart}`;
};

// Lấy khóa bí mật dùng để ký QR; ưu tiên khóa chuyên dụng.
const getQrCheckInSecret = () => (
    process.env.QR_CHECK_IN_SECRET
    || process.env.JWT_SECRET
    || process.env.STRIPE_SECRET_KEY
    || ""
);

const base64UrlEncode = (value) => Buffer
    .from(value)
    .toString("base64url");

const base64UrlDecode = (value) => Buffer
    .from(value, "base64url")
    .toString("utf8");

// Ký payload QR bằng HMAC-SHA256 để ngăn người dùng sửa dữ liệu trong QR.
const signQrPayload = (payload) => {
    const secret = getQrCheckInSecret();

    if (!secret) {
        throw new Error("QR_CHECK_IN_SECRET is not configured.");
    }

    return crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("base64url");
};

// So sánh chữ ký theo thời gian cố định để hạn chế timing attack.
const safeSignatureEquals = (left, right) => {
    const leftBuffer = Buffer.from(left || "");
    const rightBuffer = Buffer.from(right || "");

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

// Tạo token QR gồm phiên bản, payload booking và chữ ký xác thực.
export const createCheckInQrToken = (booking) => {
    if (!booking?._id || !booking?.bookingCode || !booking?.show) {
        throw new Error("Booking không đủ dữ liệu để tạo QR.");
    }

    const payload = base64UrlEncode(JSON.stringify({
        bookingId: booking._id.toString(),
        bookingCode: booking.bookingCode,
        showId: booking.show?._id?.toString?.() || booking.show.toString(),
        userId: booking.user?._id?.toString?.() || booking.user?.toString?.() || `${booking.user || ""}`,
        iat: Date.now()
    }));
    const signature = signQrPayload(payload);

    return `${QR_TOKEN_PREFIX}.${payload}.${signature}`;
};

// Kiểm tra cấu trúc/chữ ký QR rồi trả dữ liệu booking bên trong.
export const verifyCheckInQrToken = (token = "") => {
    const parts = `${token}`.trim().split(".");

    if (parts.length !== 4 || `${parts[0]}.${parts[1]}` !== QR_TOKEN_PREFIX) {
        throw new Error("QR check-in không hợp lệ.");
    }

    const [, , payload, signature] = parts;
    const expectedSignature = signQrPayload(payload);

    if (!safeSignatureEquals(signature, expectedSignature)) {
        throw new Error("QR check-in không hợp lệ hoặc đã bị thay đổi.");
    }

    try {
        return JSON.parse(base64UrlDecode(payload));
    } catch (error) {
        throw new Error("QR check-in không đọc được dữ liệu.");
    }
};

// Thêm một mốc vào lịch sử trạng thái booking.
export const appendBookingHistory = (booking, entry) => {
    booking.statusHistory = booking.statusHistory || [];
    booking.statusHistory.push({
        status: entry.status,
        paymentStatus: entry.paymentStatus || booking.paymentStatus,
        actor: entry.actor || STATUS_ACTOR.SYSTEM,
        note: entry.note || "",
        createdAt: entry.createdAt || new Date()
    });
};

// Đổi đồng bộ trạng thái booking, thanh toán, cờ isPaid và ghi lịch sử.
export const setBookingStatuses = (booking, {
    bookingStatus,
    paymentStatus,
    actor = STATUS_ACTOR.SYSTEM,
    note = "",
    isPaid = booking.isPaid
}) => {
    booking.bookingStatus = bookingStatus;
    booking.paymentStatus = paymentStatus;
    booking.isPaid = isPaid;
    booking.lastStatusChangedAt = new Date();

    appendBookingHistory(booking, {
        status: bookingStatus,
        paymentStatus,
        actor,
        note
    });
};

// Xác minh ghế thuộc sơ đồ phòng và chụp lại loại/giá từng ghế tại lúc đặt.
export const buildSeatPricingSnapshot = (showData, selectedSeats) => {
    const seatCatalog = new Map();

    (showData?.room?.seatMap || []).forEach((row) => {
        row.seats.forEach((seat) => {
            seatCatalog.set(seat.seatNumber, seat);
        });
    });

    const seatDetails = selectedSeats.map((seatNumber) => {
        const seat = seatCatalog.get(seatNumber);

        if (!seat || seat.seatType === "EMPTY") {
            throw new Error(`Ghế ${seatNumber} không hợp lệ.`);
        }

        const seatType = seat.seatType || "STANDARD";
        const pricingStrategy = STRIPE_SEAT_TYPE_PRICING[seatType] || STRIPE_SEAT_TYPE_PRICING.STANDARD;
        const unitPrice = pricingStrategy(showData.basePrice);

        return {
            seatNumber,
            seatType,
            unitPrice
        };
    });

    const amount = seatDetails.reduce((sum, seat) => sum + seat.unitPrice, 0);

    return { seatDetails, amount };
};

// Xác minh món còn bán, giới hạn số lượng và chụp lại giá/tên món tại lúc đặt.
export const buildConcessionSnapshot = async (selectedConcessions = []) => {
    if (!Array.isArray(selectedConcessions) || selectedConcessions.length === 0) {
        return { concessionItems: [], concessionAmount: 0 };
    }

    const quantityById = new Map();

    selectedConcessions.forEach((item) => {
        const concessionId = `${item?.concessionId || item?._id || item?.id || ""}`.trim();
        const quantity = Math.floor(Number(item?.quantity || 0));

        if (!concessionId || quantity <= 0) {
            return;
        }

        quantityById.set(concessionId, (quantityById.get(concessionId) || 0) + quantity);
    });

    const selectedIds = [...quantityById.keys()];
    if (selectedIds.length === 0) {
        return { concessionItems: [], concessionAmount: 0 };
    }

    const totalQuantity = [...quantityById.values()].reduce((sum, quantity) => sum + quantity, 0);

    if (totalQuantity > MAX_CONCESSION_TOTAL) {
        throw new Error(`Bạn chỉ có thể chọn tối đa ${MAX_CONCESSION_TOTAL} món đồ ăn trong một booking.`);
    }

    const concessions = await Concession.find({
        _id: { $in: selectedIds },
        status: CONCESSION_STATUS.ACTIVE
    });

    if (concessions.length !== selectedIds.length) {
        throw new Error("Một số món ăn đã ngừng bán hoặc không tồn tại.");
    }

    const concessionItems = concessions.map((item) => {
        const quantity = quantityById.get(item._id.toString());

        if (quantity > MAX_CONCESSION_PER_ITEM) {
            throw new Error(`Số lượng ${item.name} không được vượt quá ${MAX_CONCESSION_PER_ITEM}.`);
        }

        const unitPrice = Math.max(Math.floor(Number(item.price || 0)), 0);
        const totalPrice = unitPrice * quantity;

        return {
            concession: item._id,
            name: item.name,
            category: item.category,
            unitPrice,
            quantity,
            totalPrice
        };
    });

    const concessionAmount = concessionItems.reduce((sum, item) => sum + item.totalPrice, 0);

    return { concessionItems, concessionAmount };
};

// Ghép snapshot vé, món ăn và thông tin suất chiếu thành dữ liệu tạo Booking.
export const buildBookingSnapshot = async ({
    showData,
    userId,
    selectedSeats,
    bookingCode,
    selectedConcessions = [],
    paymentProvider = PAYMENT_PROVIDER.STRIPE_TEST
}) => {
    const { seatDetails, amount: ticketAmount } = buildSeatPricingSnapshot(showData, selectedSeats);
    const { concessionItems, concessionAmount } = await buildConcessionSnapshot(selectedConcessions);
    const amount = ticketAmount + concessionAmount;

    return {
        bookingCode,
        user: userId,
        show: showData._id,
        roomName: showData.room.name,
        movieTitle: showData.movie.titleVi || showData.movie.title,
        showDateTime: showData.showDateTime,
        bookedSeats: selectedSeats,
        seatDetails,
        ticketAmount,
        concessionItems,
        concessionAmount,
        amount,
        paymentProvider,
        expiresAt: new Date(Date.now() + getPaymentHoldMinutes(paymentProvider) * 60 * 1000)
    };
};

// Xóa các ghế khỏi danh sách đang giữ và/hoặc đã bán của suất chiếu.
export const releaseSeats = async (showId, seatNumbers = [], {
    fromHeld = true,
    fromOccupied = true
} = {}) => {
    if (!showId || seatNumbers.length === 0) {
        return null;
    }

    const show = await Show.findById(showId);

    if (!show) {
        return null;
    }

    seatNumbers.forEach((seatNumber) => {
        if (fromHeld && show.heldSeats?.[seatNumber]) {
            delete show.heldSeats[seatNumber];
        }

        if (fromOccupied && show.occupiedSeats?.[seatNumber]) {
            delete show.occupiedSeats[seatNumber];
        }
    });

    show.markModified("heldSeats");
    show.markModified("occupiedSeats");
    await show.save();

    return show;
};

// Khi thanh toán thành công, chuyển ghế từ heldSeats sang occupiedSeats.
export const confirmSeatsAsOccupied = async (booking) => {
    if (!booking?.show || !Array.isArray(booking.bookedSeats) || booking.bookedSeats.length === 0) {
        return null;
    }

    const show = await Show.findById(booking.show);

    if (!show) {
        return null;
    }

    booking.bookedSeats.forEach((seatNumber) => {
        if (show.heldSeats?.[seatNumber]) {
            delete show.heldSeats[seatNumber];
        }

        show.occupiedSeats[seatNumber] = booking.user;
    });

    show.markModified("heldSeats");
    show.markModified("occupiedSeats");
    await show.save();

    return show;
};

// Người dùng chỉ được hủy booking đã thanh toán trước giờ chiếu ít nhất 24 giờ.
export const canUserCancelBooking = (booking, now = new Date()) => {
    if (booking.bookingStatus !== BOOKING_STATUS.CONFIRMED || booking.paymentStatus !== PAYMENT_STATUS.PAID) {
        return false;
    }

    const showTime = new Date(booking.showDateTime || booking.show?.showDateTime);
    const diffHours = (showTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    return diffHours >= USER_CANCELLATION_NOTICE_HOURS;
};

// Admin được hủy booking chờ thanh toán/đã xác nhận miễn là suất chưa bắt đầu.
export const canAdminCancelBooking = (booking, now = new Date()) => {
    const showTime = new Date(booking.showDateTime || booking.show?.showDateTime);

    if (Number.isNaN(showTime.getTime())) {
        return false;
    }

    if (showTime.getTime() <= now.getTime()) {
        return false;
    }

    return [
        BOOKING_STATUS.PENDING_PAYMENT,
        BOOKING_STATUS.CONFIRMED
    ].includes(booking.bookingStatus);
};

// Điều kiện trạng thái cơ bản để booking có thể check-in.
export const canCheckInBooking = (booking, showtime) => {
    if (booking.bookingStatus !== BOOKING_STATUS.CONFIRMED || booking.paymentStatus !== PAYMENT_STATUS.PAID) {
        return false;
    }

    if (!showtime) {
        return false;
    }

    return showtime.status !== "CANCELLED";
};

// Kiểm tra đầy đủ trạng thái và cửa sổ thời gian trước khi check-in.
export const assertBookingCanCheckIn = (booking, showtime, now = new Date()) => {
    if (!booking) {
        throw new Error("Không tìm thấy booking.");
    }

    if (booking.bookingStatus === BOOKING_STATUS.CHECKED_IN) {
        throw new Error("Booking này đã được check-in trước đó.");
    }

    if (!canCheckInBooking(booking, showtime)) {
        throw new Error("Booking này không đủ điều kiện để check-in.");
    }

    if (getShowtimeLifecycle(showtime, now) === "ENDED") {
        throw new Error("Suất chiếu đã kết thúc, không thể check-in.");
    }

    const showTime = new Date(booking.showDateTime || showtime?.showDateTime);
    const diffMinutes = (showTime.getTime() - now.getTime()) / (1000 * 60);

    if (!Number.isFinite(diffMinutes)) {
        throw new Error("Booking thiếu thời gian suất chiếu.");
    }

    if (diffMinutes > CHECK_IN_EARLY_WINDOW_MINUTES) {
        throw new Error(`Chỉ có thể check-in trong vòng ${CHECK_IN_EARLY_WINDOW_MINUTES} phút trước giờ chiếu.`);
    }
};

// Chuyển booking sang CHECKED_IN và ghi cách check-in vào lịch sử.
export const checkInBooking = async (booking, {
    checkedInBy,
    method = "BOOKING_CODE",
    actor = STATUS_ACTOR.ADMIN
} = {}) => {
    assertBookingCanCheckIn(booking, booking?.show);

    booking.checkedInAt = new Date();
    booking.checkedInBy = checkedInBy || "";

    setBookingStatuses(booking, {
        bookingStatus: BOOKING_STATUS.CHECKED_IN,
        paymentStatus: PAYMENT_STATUS.PAID,
        actor,
        isPaid: true,
        note: method === "QR"
            ? "Check-in bằng QR code tại rạp."
            : "Check-in bằng mã booking tại quầy."
    });

    await booking.save();

    return booking;
};

// Tạo Stripe client dùng chung cho các luồng đối soát và hoàn tiền.
export const createStripeClient = () => new Stripe(process.env.STRIPE_SECRET_KEY);

// Chuẩn hóa thông báo lỗi hoàn tiền từ Stripe hoặc lỗi ứng dụng.
export const parseRefundError = (error) => {
    return error?.raw?.message || error?.message || "Không thể hoàn tiền trên Stripe.";
};

// Chính sách hiện tại: khách tự hủy nhận 80%, các trường hợp khác nhận 100% vào ví.
export const getRefundPolicyForCancellation = (cancelledBy) => {
    if (cancelledBy === "USER") {
        return {
            refundRate: USER_REFUND_RATE,
            refundMethod: REFUND_METHOD.WALLET,
            label: "Hoàn 80% giá trị booking, giữ 20% phí hủy."
        };
    }

    return {
        refundRate: FULL_REFUND_RATE,
        refundMethod: REFUND_METHOD.WALLET,
        label: "Hoàn 100% giá trị booking vào ví QuickShow."
    };
};

// Tính số tiền hoàn, phí hủy và chuẩn hóa tỷ lệ trong khoảng 0-1.
export const calculateRefundBreakdown = (booking, refundRate = FULL_REFUND_RATE) => {
    const originalAmount = Math.max(Math.floor(Number(booking?.amount || 0)), 0);
    const normalizedRate = Math.min(Math.max(Number(refundRate) || 0, 0), 1);
    const refundAmount = Math.min(Math.floor(originalAmount * normalizedRate), originalAmount);
    const refundFeeAmount = Math.max(originalAmount - refundAmount, 0);

    return {
        refundAmount,
        refundFeeAmount,
        refundRate: normalizedRate
    };
};

// Đánh dấu booking chưa thanh toán là đã hủy, không phát sinh hoàn tiền.
export const markBookingAsCancelled = (booking, {
    actor,
    cancelledBy,
    reason,
    paymentStatus = PAYMENT_STATUS.UNPAID,
    bookingStatus = BOOKING_STATUS.CANCELLED,
    isPaid = false
}) => {
    booking.cancelledBy = cancelledBy;
    booking.cancelReason = reason;
    booking.cancelledAt = new Date();
    booking.refundAmount = 0;
    booking.refundFeeAmount = 0;
    booking.refundRate = 0;
    booking.refundMethod = "";

    setBookingStatuses(booking, {
        bookingStatus,
        paymentStatus,
        actor,
        isPaid,
        note: reason
    });
};

// Chuyển booking đã trả tiền sang trạng thái chờ xử lý hoàn tiền.
export const markBookingAsRefundPending = (booking, {
    actor,
    cancelledBy,
    reason,
    refundAmount,
    refundFeeAmount,
    refundRate,
    refundMethod
}) => {
    booking.cancelledBy = cancelledBy;
    booking.cancelReason = reason;
    booking.cancelledAt = new Date();
    booking.refundReason = reason;
    booking.refundAmount = refundAmount;
    booking.refundFeeAmount = refundFeeAmount;
    booking.refundRate = refundRate;
    booking.refundMethod = refundMethod;

    setBookingStatuses(booking, {
        bookingStatus: BOOKING_STATUS.REFUND_PENDING,
        paymentStatus: PAYMENT_STATUS.REFUND_PENDING,
        actor,
        isPaid: true,
        note: reason
    });
};

// Ghi nhận hoàn tiền thành công và kết thúc vòng đời booking.
export const markBookingAsRefunded = (booking, {
    actor,
    refund,
    reason,
    refundAmount,
    refundFeeAmount,
    refundRate,
    refundMethod
}) => {
    booking.refundedAt = new Date();
    const settledRefundAmount = refundAmount ?? refund?.amount;
    booking.refundAmount = Math.min(settledRefundAmount || booking.amount, booking.amount);
    booking.refundFeeAmount = refundFeeAmount ?? Math.max((booking.amount || 0) - (booking.refundAmount || 0), 0);
    booking.refundRate = refundRate ?? (booking.amount ? booking.refundAmount / booking.amount : 0);
    booking.refundMethod = refundMethod || booking.refundMethod;
    booking.refundReason = reason;
    if ([REFUND_METHOD.STRIPE, REFUND_METHOD.MIXED].includes(booking.refundMethod)) {
        booking.stripeRefundId = refund?.id || booking.stripeRefundId;
    }

    setBookingStatuses(booking, {
        bookingStatus: BOOKING_STATUS.REFUNDED,
        paymentStatus: PAYMENT_STATUS.REFUNDED,
        actor,
        isPaid: false,
        note: reason
    });
};

// Khôi phục booking về CONFIRMED khi hoàn tiền thất bại để có thể xử lý lại.
export const markRefundFailed = (booking, {
    actor,
    reason
}) => {
    booking.cancelledBy = "";
    booking.cancelReason = "";
    booking.cancelledAt = null;
    booking.refundReason = reason;
    booking.refundAmount = 0;
    booking.refundFeeAmount = 0;
    booking.refundRate = 0;
    booking.refundMethod = "";

    setBookingStatuses(booking, {
        bookingStatus: BOOKING_STATUS.CONFIRMED,
        paymentStatus: PAYMENT_STATUS.REFUND_FAILED,
        actor,
        isPaid: true,
        note: reason
    });
};

// Hủy booking theo trạng thái thanh toán: hoàn ví đã dùng nếu chưa trả, hoặc hoàn tiền vào ví nếu đã trả.
export const cancelBookingAndHandlePayment = async (booking, {
    actor,
    cancelledBy,
    reason
}) => {
    const isPaidBooking = [
        PAYMENT_STATUS.PAID,
        PAYMENT_STATUS.REFUND_FAILED
    ].includes(booking.paymentStatus);

    // Booking chưa thanh toán chỉ cần hoàn phần ví đã trừ và nhả ghế đang giữ.
    if (!isPaidBooking) {
        markBookingAsCancelled(booking, {
            actor,
            cancelledBy,
            reason,
            paymentStatus: booking.paymentStatus === PAYMENT_STATUS.EXPIRED
                ? PAYMENT_STATUS.EXPIRED
                : PAYMENT_STATUS.UNPAID,
            isPaid: false
        });
        if (booking.walletAmountUsed > 0) {
            await reverseWalletDebit({
                userId: booking.user,
                bookingId: booking._id,
                amount: booking.walletAmountUsed,
                note: `Hoàn lại ví vì booking ${booking.bookingCode} bị hủy trước khi thanh toán Stripe.`,
                metadata: { bookingCode: booking.bookingCode, cancelledBy }
            });
            booking.walletAmountUsed = 0;
        }
        await booking.save();
        await releaseSeats(booking.show, booking.bookedSeats, {
            fromHeld: true,
            fromOccupied: false
        });
        return {
            booking,
            releasedSeats: booking.bookedSeats,
            refund: null,
            refundAmount: 0,
            refundFeeAmount: 0,
            refundRate: 0
        };
    }

    const refundPolicy = getRefundPolicyForCancellation(cancelledBy);
    const refundBreakdown = calculateRefundBreakdown(booking, refundPolicy.refundRate);
    const refundMethod = REFUND_METHOD.WALLET;

    // Lưu REFUND_PENDING trước khi cộng ví để trạng thái phản ánh đúng nếu bước hoàn tiền lỗi.
    markBookingAsRefundPending(booking, {
        actor,
        cancelledBy,
        reason,
        ...refundBreakdown,
        refundMethod
    });
    await booking.save();

    try {
        const walletRefund = await creditWallet({
            userId: booking.user,
            bookingId: booking._id,
            amount: refundBreakdown.refundAmount,
            note: `Hoàn ${Math.round(refundBreakdown.refundRate * 100)}% booking ${booking.bookingCode} vào ví QuickShow.`,
            metadata: {
                bookingCode: booking.bookingCode,
                cancelledBy,
                refundRate: refundBreakdown.refundRate,
                refundMethod
            }
        });

        markBookingAsRefunded(booking, {
            actor,
            refund: walletRefund,
            reason,
            ...refundBreakdown,
            refundMethod
        });
        await booking.save();
        await releaseSeats(booking.show, booking.bookedSeats, {
            fromHeld: true,
            fromOccupied: true
        });

        return {
            booking,
            releasedSeats: booking.bookedSeats,
            refund: walletRefund,
            walletRefund,
            ...refundBreakdown,
            refundPolicy: {
                ...refundPolicy,
                refundMethod
            }
        };
    } catch (error) {
        markRefundFailed(booking, {
            actor,
            reason: parseRefundError(error)
        });
        await booking.save();
        throw new Error(parseRefundError(error));
    }
};

// Xác nhận thanh toán theo cách idempotent rồi chuyển ghế giữ tạm thành ghế đã bán.
export const confirmBookingPaid = async (booking, {
    actor = STATUS_ACTOR.STRIPE,
    note = "Stripe xác nhận thanh toán thành công.",
    sessionId = "",
    paymentIntentId = ""
} = {}) => {
    if (!booking) {
        return null;
    }

    if (booking.paymentStatus === PAYMENT_STATUS.PAID && booking.bookingStatus === BOOKING_STATUS.CONFIRMED) {
        return booking;
    }

    if ([BOOKING_STATUS.CANCELLED, BOOKING_STATUS.PAYMENT_EXPIRED, BOOKING_STATUS.REFUNDED].includes(booking.bookingStatus)) {
        return booking;
    }

    booking.paymentLink = "";
    booking.stripeSessionId = sessionId || booking.stripeSessionId;
    booking.paymentIntentId = paymentIntentId || booking.paymentIntentId;

    setBookingStatuses(booking, {
        bookingStatus: BOOKING_STATUS.CONFIRMED,
        paymentStatus: PAYMENT_STATUS.PAID,
        actor,
        isPaid: true,
        note
    });

    await booking.save();
    await confirmSeatsAsOccupied(booking);

    return booking;
};

// Chủ động hỏi Stripe để cập nhật booking khi webhook chưa được nhận hoặc xử lý kịp.
export const syncBookingPaymentWithStripe = async (booking) => {
    if (!booking?.stripeSessionId) {
        return { updated: false, booking };
    }

    if (booking.paymentStatus !== PAYMENT_STATUS.UNPAID || booking.bookingStatus !== BOOKING_STATUS.PENDING_PAYMENT) {
        return { updated: false, booking };
    }

    const stripeClient = createStripeClient();
    const session = await stripeClient.checkout.sessions.retrieve(booking.stripeSessionId);

    if (!session || session.payment_status !== "paid") {
        return { updated: false, booking, session };
    }

    const updatedBooking = await confirmBookingPaid(booking, {
        actor: STATUS_ACTOR.STRIPE,
        note: "Đồng bộ thanh toán thành công từ Stripe session.",
        sessionId: session.id,
        paymentIntentId: `${session.payment_intent || booking.paymentIntentId || ""}`
    });

    return { updated: true, booking: updatedBooking, session };
};

// Suy ra và bổ sung trạng thái cho booking cũ được tạo trước khi hệ thống quản lý trạng thái đầy đủ.
export const reconcileLegacyBookingState = async (booking) => {
    if (!booking) {
        return { updated: false, booking };
    }

    const hasHistory = Array.isArray(booking.statusHistory) && booking.statusHistory.length > 0;
    const hasValidManagedState = Boolean(booking.bookingStatus && booking.paymentStatus);
    const hasPaidInconsistency = booking.isPaid && booking.paymentStatus !== PAYMENT_STATUS.PAID;
    const hasConfirmedInconsistency = booking.isPaid && booking.bookingStatus === BOOKING_STATUS.PENDING_PAYMENT;

    if (hasHistory && hasValidManagedState && !hasPaidInconsistency && !hasConfirmedInconsistency) {
        return { updated: false, booking };
    }

    const showDate = new Date(booking.showDateTime || booking.show?.showDateTime || booking.createdAt);
    const hasEnded = booking.show ? getShowtimeLifecycle(booking.show) === "ENDED" : false;

    let nextBookingStatus = booking.bookingStatus;
    let nextPaymentStatus = booking.paymentStatus;
    let nextIsPaid = booking.isPaid;

    if (booking.refundedAt || booking.stripeRefundId) {
        nextBookingStatus = BOOKING_STATUS.REFUNDED;
        nextPaymentStatus = PAYMENT_STATUS.REFUNDED;
        nextIsPaid = false;
    } else if (booking.checkedInAt) {
        nextBookingStatus = BOOKING_STATUS.CHECKED_IN;
        nextPaymentStatus = PAYMENT_STATUS.PAID;
        nextIsPaid = true;
    } else if (booking.isPaid) {
        nextBookingStatus = hasEnded ? BOOKING_STATUS.NO_SHOW : BOOKING_STATUS.CONFIRMED;
        nextPaymentStatus = PAYMENT_STATUS.PAID;
        nextIsPaid = true;
    } else if (booking.cancelledAt || booking.cancelReason) {
        nextBookingStatus = BOOKING_STATUS.CANCELLED;
        nextPaymentStatus = booking.paymentStatus === PAYMENT_STATUS.EXPIRED ? PAYMENT_STATUS.EXPIRED : PAYMENT_STATUS.UNPAID;
        nextIsPaid = false;
    } else if (booking.paymentLink && booking.expiresAt && new Date(booking.expiresAt) > new Date()) {
        nextBookingStatus = BOOKING_STATUS.PENDING_PAYMENT;
        nextPaymentStatus = PAYMENT_STATUS.UNPAID;
        nextIsPaid = false;
    } else {
        nextBookingStatus = showDate.getTime() < Date.now()
            ? BOOKING_STATUS.PAYMENT_EXPIRED
            : BOOKING_STATUS.PAYMENT_EXPIRED;
        nextPaymentStatus = PAYMENT_STATUS.EXPIRED;
        nextIsPaid = false;
    }

    const hasChanged = nextBookingStatus !== booking.bookingStatus
        || nextPaymentStatus !== booking.paymentStatus
        || nextIsPaid !== booking.isPaid
        || !hasHistory;

    if (!hasChanged) {
        return { updated: false, booking };
    }

    booking.bookingStatus = nextBookingStatus;
    booking.paymentStatus = nextPaymentStatus;
    booking.isPaid = nextIsPaid;
    booking.lastStatusChangedAt = booking.lastStatusChangedAt || new Date();

    appendBookingHistory(booking, {
        status: nextBookingStatus,
        paymentStatus: nextPaymentStatus,
        actor: STATUS_ACTOR.SYSTEM,
        note: "Đồng bộ trạng thái từ dữ liệu booking cũ."
    });

    await booking.save();

    return { updated: true, booking };
};
