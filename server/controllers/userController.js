import { clerkClient } from "@clerk/express";
import Booking from "../models/Booking.js";
import Movie from "../models/Movie.js";
import { inngest } from "../inngest/index.js";
import {
    STATUS_ACTOR,
    canUserCancelBooking,
    cancelBookingAndHandlePayment,
    confirmBookingPaid,
    createStripeClient,
    reconcileLegacyBookingState,
    syncBookingPaymentWithStripe
} from "../services/bookingService.js";

const ensureAuthenticatedUser = (req) => {
    const userId = req.auth?.()?.userId;

    if (!userId) {
        throw new Error("Vui lòng đăng nhập để tiếp tục.");
    }

    return userId;
};

export const getUserBookings = async (req, res) => {
    try {
        const userId = ensureAuthenticatedUser(req);

        const bookings = await Booking.find({ user: userId })
            .populate({
                path: "show",
                populate: [{ path: "movie" }, { path: "room" }]
            })
            .sort({ createdAt: -1 });

        for (const booking of bookings) {
            try {
                await reconcileLegacyBookingState(booking);
                const result = await syncBookingPaymentWithStripe(booking);
                if (result.updated) {
                    await inngest.send({
                        name: "app/show.booked",
                        data: { bookingId: booking._id.toString() }
                    });
                }
            } catch (error) {
                console.error(`[Sync Stripe] Không thể đồng bộ booking ${booking._id}:`, error.message);
            }
        }

        res.json({ success: true, bookings });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi tải lịch sử đặt vé: " + error.message });
    }
};

export const confirmMyBookingPayment = async (req, res) => {
    try {
        const userId = ensureAuthenticatedUser(req);
        const sessionId = `${req.body?.sessionId || ""}`.trim();

        if (!sessionId) {
            return res.json({ success: false, message: "Thiếu mã phiên thanh toán Stripe." });
        }

        const stripeClient = createStripeClient();
        const session = await stripeClient.checkout.sessions.retrieve(sessionId);
        const bookingId = session?.metadata?.bookingId;

        if (!bookingId) {
            return res.json({ success: false, message: "Không tìm thấy booking gắn với phiên thanh toán này." });
        }

        const booking = await Booking.findOne({ _id: bookingId, user: userId });

        if (!booking) {
            return res.json({ success: false, message: "Không tìm thấy booking của bạn." });
        }

        if (session.payment_status !== "paid") {
            return res.json({
                success: true,
                updated: false,
                message: "Stripe chưa xác nhận thanh toán thành công cho booking này."
            });
        }

        await confirmBookingPaid(booking, {
            actor: STATUS_ACTOR.STRIPE,
            note: "Người dùng quay lại từ trang thanh toán và hệ thống đồng bộ trạng thái từ Stripe.",
            sessionId: session.id,
            paymentIntentId: `${session.payment_intent || booking.paymentIntentId || ""}`
        });

        await inngest.send({
            name: "app/show.booked",
            data: { bookingId: booking._id.toString() }
        });

        const io = req.app.get("io");
        if (io) {
            io.to(booking.show.toString()).emit("seats_booked_successfully", booking.bookedSeats);
        }

        res.json({
            success: true,
            updated: true,
            message: "Đã đồng bộ trạng thái thanh toán thành công."
        });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi đồng bộ thanh toán Stripe: " + error.message });
    }
};

export const cancelMyBooking = async (req, res) => {
    try {
        const userId = ensureAuthenticatedUser(req);
        const { bookingId } = req.params;
        const cancelReason = `${req.body?.cancelReason || "Khách hàng chủ động hủy vé."}`.trim();

        const booking = await Booking.findOne({ _id: bookingId, user: userId }).populate("show");

        if (!booking) {
            return res.json({ success: false, message: "Không tìm thấy booking." });
        }

        if (!canUserCancelBooking(booking)) {
            return res.json({
                success: false,
                message: "Bạn chỉ có thể hủy vé đã thanh toán trước giờ chiếu ít nhất 24 giờ."
            });
        }

        const result = await cancelBookingAndHandlePayment(booking, {
            actor: STATUS_ACTOR.USER,
            cancelledBy: "USER",
            reason: cancelReason
        });

        const io = req.app.get("io");
        if (io && result.releasedSeats?.length) {
            io.to(booking.show?._id?.toString() || booking.show.toString()).emit("seats_released", result.releasedSeats);
        }

        res.json({
            success: true,
            message: "Đã hủy booking và gửi yêu cầu hoàn tiền trên Stripe test."
        });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi hủy booking: " + error.message });
    }
};

export const updateFavorite = async (req, res) => {
    try {
        const { movieId } = req.body;
        const userId = ensureAuthenticatedUser(req);

        const user = await clerkClient.users.getUser(userId);

        if (!user.privateMetadata.favorites) {
            user.privateMetadata.favorites = [];
        }

        if (!user.privateMetadata.favorites.includes(movieId)) {
            user.privateMetadata.favorites.push(movieId);
        } else {
            user.privateMetadata.favorites = user.privateMetadata.favorites.filter((item) => item !== movieId);
        }

        await clerkClient.users.updateUserMetadata(userId, { privateMetadata: user.privateMetadata });

        res.json({ success: true, message: "Đã cập nhật danh sách phim yêu thích." });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi cập nhật phim yêu thích: " + error.message });
    }
};

export const getFavorites = async (req, res) => {
    try {
        const userId = ensureAuthenticatedUser(req);
        const user = await clerkClient.users.getUser(userId);
        const favorites = user.privateMetadata.favorites || [];

        const movies = await Movie.find({ _id: { $in: favorites } });

        res.json({ success: true, movies });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi tải danh sách phim yêu thích: " + error.message });
    }
};
