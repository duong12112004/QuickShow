import Stripe from "stripe";
import Show from "../models/Show.js";
import { getShowtimeLifecycle } from "./showtimeService.js";

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

export const PAYMENT_STATUS = {
    UNPAID: "UNPAID",
    PAID: "PAID",
    EXPIRED: "EXPIRED",
    REFUND_PENDING: "REFUND_PENDING",
    REFUNDED: "REFUNDED",
    REFUND_FAILED: "REFUND_FAILED"
};

export const PAYMENT_PROVIDER = {
    STRIPE_TEST: "STRIPE_TEST"
};

export const STATUS_ACTOR = {
    USER: "USER",
    ADMIN: "ADMIN",
    SYSTEM: "SYSTEM",
    STRIPE: "STRIPE"
};

export const PAYMENT_HOLD_MINUTES = 30;
export const USER_CANCELLATION_NOTICE_HOURS = 24;

const STRIPE_SEAT_TYPE_PRICING = {
    STANDARD: (basePrice) => basePrice,
    VIP: (basePrice) => basePrice + 20000,
    COUPLE: (basePrice) => basePrice * 2
};

export const createBookingCode = () => {
    const timestamp = Date.now().toString().slice(-6);
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `QS${timestamp}${randomPart}`;
};

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

export const buildBookingSnapshot = ({ showData, userId, selectedSeats, bookingCode }) => {
    const { seatDetails, amount } = buildSeatPricingSnapshot(showData, selectedSeats);

    return {
        bookingCode,
        user: userId,
        show: showData._id,
        roomName: showData.room.name,
        movieTitle: showData.movie.title,
        showDateTime: showData.showDateTime,
        bookedSeats: selectedSeats,
        seatDetails,
        amount,
        paymentProvider: PAYMENT_PROVIDER.STRIPE_TEST,
        expiresAt: new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60 * 1000)
    };
};

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

export const canUserCancelBooking = (booking, now = new Date()) => {
    if (booking.bookingStatus !== BOOKING_STATUS.CONFIRMED || booking.paymentStatus !== PAYMENT_STATUS.PAID) {
        return false;
    }

    const showTime = new Date(booking.showDateTime || booking.show?.showDateTime);
    const diffHours = (showTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    return diffHours >= USER_CANCELLATION_NOTICE_HOURS;
};

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

export const canCheckInBooking = (booking, showtime) => {
    if (booking.bookingStatus !== BOOKING_STATUS.CONFIRMED || booking.paymentStatus !== PAYMENT_STATUS.PAID) {
        return false;
    }

    if (!showtime) {
        return false;
    }

    return showtime.status !== "CANCELLED";
};

export const createStripeClient = () => new Stripe(process.env.STRIPE_SECRET_KEY);

export const parseRefundError = (error) => {
    return error?.raw?.message || error?.message || "Không thể hoàn tiền trên Stripe.";
};

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

    setBookingStatuses(booking, {
        bookingStatus,
        paymentStatus,
        actor,
        isPaid,
        note: reason
    });
};

export const markBookingAsRefundPending = (booking, {
    actor,
    cancelledBy,
    reason
}) => {
    booking.cancelledBy = cancelledBy;
    booking.cancelReason = reason;
    booking.cancelledAt = new Date();
    booking.refundReason = reason;

    setBookingStatuses(booking, {
        bookingStatus: BOOKING_STATUS.REFUND_PENDING,
        paymentStatus: PAYMENT_STATUS.REFUND_PENDING,
        actor,
        isPaid: true,
        note: reason
    });
};

export const markBookingAsRefunded = (booking, {
    actor,
    refund,
    reason
}) => {
    booking.refundedAt = new Date();
    booking.refundAmount = refund?.amount ? refund.amount : booking.amount;
    booking.refundReason = reason;
    booking.stripeRefundId = refund?.id || booking.stripeRefundId;

    setBookingStatuses(booking, {
        bookingStatus: BOOKING_STATUS.REFUNDED,
        paymentStatus: PAYMENT_STATUS.REFUNDED,
        actor,
        isPaid: false,
        note: reason
    });
};

export const markRefundFailed = (booking, {
    actor,
    reason
}) => {
    booking.cancelledBy = "";
    booking.cancelReason = "";
    booking.cancelledAt = null;
    booking.refundReason = reason;

    setBookingStatuses(booking, {
        bookingStatus: BOOKING_STATUS.CONFIRMED,
        paymentStatus: PAYMENT_STATUS.REFUND_FAILED,
        actor,
        isPaid: true,
        note: reason
    });
};

export const cancelBookingAndHandlePayment = async (booking, {
    actor,
    cancelledBy,
    reason
}) => {
    const isPaidBooking = [
        PAYMENT_STATUS.PAID,
        PAYMENT_STATUS.REFUND_FAILED
    ].includes(booking.paymentStatus);

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
        await booking.save();
        await releaseSeats(booking.show, booking.bookedSeats, {
            fromHeld: true,
            fromOccupied: false
        });
        return { booking, releasedSeats: booking.bookedSeats, refund: null };
    }

    if (!booking.paymentIntentId) {
        throw new Error("Không tìm thấy giao dịch Stripe để hoàn tiền.");
    }

    markBookingAsRefundPending(booking, { actor, cancelledBy, reason });
    await booking.save();

    try {
        const stripeClient = createStripeClient();
        const refund = await stripeClient.refunds.create({
            payment_intent: booking.paymentIntentId,
            metadata: {
                bookingId: booking._id.toString(),
                bookingCode: booking.bookingCode
            }
        });

        markBookingAsRefunded(booking, { actor, refund, reason });
        await booking.save();
        await releaseSeats(booking.show, booking.bookedSeats, {
            fromHeld: true,
            fromOccupied: true
        });

        return { booking, releasedSeats: booking.bookedSeats, refund };
    } catch (error) {
        markRefundFailed(booking, {
            actor,
            reason: parseRefundError(error)
        });
        await booking.save();
        throw new Error(parseRefundError(error));
    }
};

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
