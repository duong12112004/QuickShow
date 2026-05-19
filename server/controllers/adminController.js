import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import User from "../models/User.js";
import { inngest } from "../inngest/index.js";
import {
    BOOKING_STATUS,
    PAYMENT_STATUS,
    STATUS_ACTOR,
    cancelBookingAndHandlePayment,
    canAdminCancelBooking,
    canCheckInBooking,
    reconcileLegacyBookingState,
    syncBookingPaymentWithStripe,
    setBookingStatuses
} from "../services/bookingService.js";
import {
    assertNoShowtimeOverlap,
    assertNoLocalShowtimeOverlap,
    assertShowtimeNotInPast,
    buildScheduledShowtimeFilter,
    buildShowtimeSnapshot,
    ensureMovieExists,
    ensureRoomIsActive,
    getShowtimeLifecycle,
    hasBookingsOrHeldSeats,
    SHOWTIME_STATUS,
    serializeAdminShowtime,
    validateCancelShowtimePayload,
    validateCreateShowtimePayload,
    validateUpdateShowtimePayload
} from "../services/showtimeService.js";

const PAID_BOOKING_MATCH = {
    paymentStatus: {
        $in: [
            PAYMENT_STATUS.PAID,
            PAYMENT_STATUS.REFUND_PENDING,
            PAYMENT_STATUS.REFUNDED,
            PAYMENT_STATUS.REFUND_FAILED
        ]
    }
};

const BOOKING_FINAL_STATUSES = [
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.PAYMENT_EXPIRED,
    BOOKING_STATUS.REFUNDED,
    BOOKING_STATUS.NO_SHOW
];

const emitSeatsReleased = (req, showId, seats = []) => {
    const io = req.app.get("io");

    if (io && showId && seats.length > 0) {
        io.to(showId.toString()).emit("seats_released", seats);
    }
};

const buildRevenueMap = async (showIds) => {
    if (showIds.length === 0) {
        return new Map();
    }

    const rows = await Booking.aggregate([
        {
            $match: {
                show: { $in: showIds },
                ...PAID_BOOKING_MATCH
            }
        },
        {
            $group: {
                _id: "$show",
                totalEarnings: { $sum: "$amount" },
                paidBookings: { $sum: 1 }
            }
        }
    ]);

    return new Map(rows.map((row) => [row._id.toString(), row]));
};

const applyInMemoryBookingFilters = (bookings, { q, fromDate, toDate }) => {
    const normalizedQuery = `${q || ""}`.trim().toLowerCase();

    return bookings.filter((booking) => {
        const bookingShowDateTime = booking.showDateTime || booking.show?.showDateTime;

        if (normalizedQuery) {
            const haystack = [
                booking.bookingCode,
                booking.movieTitle || booking.show?.movie?.title,
                booking.roomName || booking.show?.room?.name,
                booking.user?.name,
                booking.user?.email
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            if (!haystack.includes(normalizedQuery)) {
                return false;
            }
        }

        if (fromDate) {
            const from = new Date(fromDate);
            if (!bookingShowDateTime || new Date(bookingShowDateTime) < from) {
                return false;
            }
        }

        if (toDate) {
            const to = new Date(toDate);
            to.setHours(23, 59, 59, 999);

            if (!bookingShowDateTime || new Date(bookingShowDateTime) > to) {
                return false;
            }
        }

        return true;
    });
};

const buildBookingQuery = ({ bookingStatus, paymentStatus }) => {
    const query = {};

    if (bookingStatus) {
        query.bookingStatus = bookingStatus;
    }

    if (paymentStatus) {
        query.paymentStatus = paymentStatus;
    }

    return query;
};

const formatCsvValue = (value) => {
    const safe = `${value ?? ""}`.replace(/"/g, "\"\"");
    return `"${safe}"`;
};

const serializeBookingsToCsv = (bookings) => {
    const headers = [
        "Mã booking",
        "Người dùng",
        "Email",
        "Phim",
        "Phòng",
        "Lịch chiếu",
        "Ghế",
        "Trạng thái booking",
        "Trạng thái thanh toán",
        "Tổng tiền",
        "Thanh toán bằng ví",
        "Thanh toán Stripe",
        "Số tiền hoàn",
        "Hoàn Stripe",
        "Hoàn ví",
        "Phí hủy",
        "Tỷ lệ hoàn",
        "Phương thức hoàn",
        "Lý do hủy",
        "Hoàn tiền lúc",
        "Check-in lúc"
    ];

    const rows = bookings.map((booking) => {
        const effectiveRefundAmount = booking.refundAmount > 0
            ? booking.refundAmount
            : booking.paymentStatus === PAYMENT_STATUS.REFUNDED
                ? booking.amount
                : 0;

        return [
        booking.bookingCode,
        booking.user?.name || "Người dùng đã xóa",
        booking.user?.email || "",
        booking.movieTitle || booking.show?.movie?.title || "",
        booking.roomName || booking.show?.room?.name || "",
        booking.showDateTime || booking.show?.showDateTime
            ? new Date(booking.showDateTime || booking.show?.showDateTime).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
            : "",
        booking.bookedSeats.join(", "),
        booking.bookingStatus,
        booking.paymentStatus,
        booking.amount,
        booking.walletAmountUsed || 0,
        booking.stripeAmount || 0,
        effectiveRefundAmount,
        booking.stripeRefundAmount || 0,
        booking.walletRefundAmount || 0,
        booking.refundFeeAmount || 0,
        booking.refundRate ? `${Math.round(booking.refundRate * 100)}%` : "",
        booking.refundMethod || "",
        booking.cancelReason || "",
        booking.refundedAt ? new Date(booking.refundedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "",
        booking.checkedInAt ? new Date(booking.checkedInAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : ""
        ].map(formatCsvValue).join(",");
    });

    return `\uFEFF${headers.map(formatCsvValue).join(",")}\n${rows.join("\n")}`;
};

const getAdminUserId = (req) => req.auth?.()?.userId || "admin";

export const isAdmin = async (req, res) => {
    res.json({ success: true, isAdmin: true });
};

export const getDashboardData = async (req, res) => {
    try {
        const [paidStats] = await Booking.aggregate([
            { $match: PAID_BOOKING_MATCH },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$amount" },
                    totalBookings: { $sum: 1 }
                }
            }
        ]);

        const [refundStats] = await Booking.aggregate([
            { $match: { paymentStatus: PAYMENT_STATUS.REFUNDED } },
            {
                $group: {
                    _id: null,
                    totalRefunds: {
                        $sum: {
                            $cond: [
                                { $gt: [{ $ifNull: ["$refundAmount", 0] }, 0] },
                                "$refundAmount",
                                "$amount"
                            ]
                        }
                    }
                }
            }
        ]);

        const activeShows = await Show.find({
            showDateTime: { $gte: new Date() },
            ...buildScheduledShowtimeFilter()
        })
            .populate("movie")
            .sort({ showDateTime: 1 });

        const totalUser = await User.countDocuments();

        const dashboardData = {
            totalBookings: paidStats?.totalBookings || 0,
            totalRevenue: Math.max((paidStats?.totalRevenue || 0) - (refundStats?.totalRefunds || 0), 0),
            totalRefunds: refundStats?.totalRefunds || 0,
            activeShows,
            totalUser
        };

        res.json({ success: true, dashboardData });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tải dữ liệu dashboard: " + error.message });
    }
};

export const getAdminShowtimes = async (req, res) => {
    try {
        const showtimes = await Show.find({})
            .populate("movie")
            .populate("room")
            .sort({ showDateTime: 1 });

        const revenueMap = await buildRevenueMap(showtimes.map((showtime) => showtime._id));
        const now = new Date();

        const items = showtimes.map((showtime) => {
            const summary = revenueMap.get(showtime._id.toString());
            return {
                ...serializeAdminShowtime(showtime, now),
                totalEarnings: summary?.totalEarnings || 0,
                paidBookings: summary?.paidBookings || 0
            };
        });

        res.json({ success: true, showtimes: items });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tải danh sách suất chiếu: " + error.message });
    }
};

export const getAllShows = getAdminShowtimes;

export const createShowtime = async (req, res) => {
    try {
        const { movieId, roomId, basePrice, cleanupMinutes, showtimes } = validateCreateShowtimePayload(req.body);
        await ensureRoomIsActive(roomId);
        const movie = await ensureMovieExists(movieId);

        const docs = [];
        for (const showDateTime of showtimes) {
            assertShowtimeNotInPast(showDateTime);
            assertNoLocalShowtimeOverlap({
                draftShowtimes: docs,
                showDateTime,
                runtimeMinutes: movie.runtime,
                cleanupMinutes
            });
            await assertNoShowtimeOverlap({
                roomId,
                showDateTime,
                runtimeMinutes: movie.runtime,
                cleanupMinutes
            });

            docs.push(buildShowtimeSnapshot({
                movieId,
                roomId,
                showDateTime,
                basePrice,
                runtimeMinutes: movie.runtime,
                cleanupMinutes
            }));
        }

        const created = await Show.insertMany(docs);

        await inngest.send({
            name: "app/show.added",
            data: { movieTitle: movie.title }
        });

        res.json({
            success: true,
            message: docs.length > 1 ? "Đã tạo các suất chiếu thành công." : "Đã tạo suất chiếu thành công.",
            showtimes: created
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tạo suất chiếu: " + error.message });
    }
};

export const updateShowtime = async (req, res) => {
    try {
        const { showId } = req.params;
        const updates = validateUpdateShowtimePayload(req.body);
        const showtime = await Show.findById(showId).populate("movie").populate("room");

        if (!showtime) {
            return res.json({ success: false, message: "Suất chiếu không tồn tại." });
        }

        if ((showtime.status || SHOWTIME_STATUS.SCHEDULED) === SHOWTIME_STATUS.CANCELLED) {
            return res.json({ success: false, message: "Suất chiếu đã hủy, không thể chỉnh sửa." });
        }

        const lifecycle = getShowtimeLifecycle(showtime);
        if (lifecycle !== "UPCOMING") {
            return res.json({ success: false, message: "Chỉ có thể sửa suất chiếu sắp tới." });
        }

        if (hasBookingsOrHeldSeats(showtime)) {
            return res.json({
                success: false,
                message: "Suất chiếu đã có vé bán ra hoặc đang giữ chỗ. Hãy hủy suất thay vì chỉnh sửa."
            });
        }

        const movie = updates.movieId ? await ensureMovieExists(updates.movieId) : showtime.movie;
        const roomId = updates.roomId || showtime.room._id;
        const showDateTime = updates.showDateTime || showtime.showDateTime;
        const cleanupMinutes = updates.cleanupMinutes ?? showtime.cleanupMinutes;
        const basePrice = updates.basePrice ?? showtime.basePrice;

        await ensureRoomIsActive(roomId);
        assertShowtimeNotInPast(showDateTime);
        await assertNoShowtimeOverlap({
            roomId,
            showDateTime,
            runtimeMinutes: movie.runtime,
            cleanupMinutes,
            excludeShowtimeId: showtime._id
        });

        showtime.movie = movie._id;
        showtime.room = roomId;
        showtime.showDateTime = new Date(showDateTime);
        showtime.runtimeMinutes = movie.runtime;
        showtime.cleanupMinutes = cleanupMinutes;
        showtime.endDateTime = buildShowtimeSnapshot({
            movieId: movie._id,
            roomId,
            showDateTime,
            basePrice,
            runtimeMinutes: movie.runtime,
            cleanupMinutes
        }).endDateTime;
        showtime.basePrice = basePrice;
        await showtime.save();

        res.json({ success: true, message: "Đã cập nhật suất chiếu thành công." });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi cập nhật suất chiếu: " + error.message });
    }
};

export const cancelShowtime = async (req, res) => {
    try {
        const { showId } = req.params;
        const { cancellationReason } = validateCancelShowtimePayload(req.body);
        const showtime = await Show.findById(showId);

        if (!showtime) {
            return res.json({ success: false, message: "Suất chiếu không tồn tại." });
        }

        if ((showtime.status || SHOWTIME_STATUS.SCHEDULED) === SHOWTIME_STATUS.CANCELLED) {
            return res.json({ success: false, message: "Suất chiếu này đã được hủy trước đó." });
        }

        const lifecycle = getShowtimeLifecycle(showtime);
        if (lifecycle === "ENDED") {
            return res.json({ success: false, message: "Không thể hủy suất chiếu đã kết thúc." });
        }

        showtime.status = SHOWTIME_STATUS.CANCELLED;
        showtime.cancellationReason = cancellationReason;
        showtime.cancelledAt = new Date();
        showtime.heldSeats = {};
        showtime.markModified("heldSeats");
        await showtime.save();

        const bookings = await Booking.find({
            show: showtime._id,
            bookingStatus: { $nin: BOOKING_FINAL_STATUSES }
        });

        let refundedCount = 0;
        let failedRefundCount = 0;
        let cancelledCount = 0;
        const releasedSeats = [];

        for (const booking of bookings) {
            try {
                const result = await cancelBookingAndHandlePayment(booking, {
                    actor: STATUS_ACTOR.SYSTEM,
                    cancelledBy: "SYSTEM",
                    reason: `Suất chiếu bị hủy: ${cancellationReason}`
                });

                if (result.refund) {
                    refundedCount += 1;
                } else {
                    cancelledCount += 1;
                }

                releasedSeats.push(...(result.releasedSeats || []));
            } catch (error) {
                failedRefundCount += 1;
            }
        }

        emitSeatsReleased(req, showtime._id, [...new Set(releasedSeats)]);

        res.json({
            success: true,
            message: `Đã hủy suất chiếu thành công. Hoàn tiền ${refundedCount} booking, hủy ${cancelledCount} booking chờ thanh toán${failedRefundCount ? `, ${failedRefundCount} booking hoàn tiền thất bại` : ""}.`
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi hủy suất chiếu: " + error.message });
    }
};

export const deleteShowtime = async (req, res) => {
    try {
        const { showId } = req.params;
        const showtime = await Show.findById(showId);

        if (!showtime) {
            return res.json({ success: false, message: "Suất chiếu không tồn tại." });
        }

        if (hasBookingsOrHeldSeats(showtime)) {
            return res.json({
                success: false,
                message: "Không thể xóa suất chiếu đã có vé bán ra hoặc đang giữ chỗ."
            });
        }

        const lifecycle = getShowtimeLifecycle(showtime);
        if (lifecycle !== "UPCOMING" && lifecycle !== "CANCELLED") {
            return res.json({ success: false, message: "Chỉ có thể xóa suất chiếu chưa diễn ra." });
        }

        await Show.findByIdAndDelete(showId);

        res.json({ success: true, message: "Đã xóa suất chiếu thành công." });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi xóa suất chiếu: " + error.message });
    }
};

export const getAllBookings = async (req, res) => {
    try {
        const query = buildBookingQuery(req.query);
        const bookings = await Booking.find(query)
            .populate("user")
            .populate({
                path: "show",
                populate: [{ path: "movie" }, { path: "room" }]
            })
            .sort({ createdAt: -1 });

        for (const booking of bookings) {
            try {
                await reconcileLegacyBookingState(booking);
                await syncBookingPaymentWithStripe(booking);
            } catch (error) {
                console.error(`[Sync Stripe] Không thể đồng bộ booking ${booking._id}:`, error.message);
            }
        }

        const filteredBookings = applyInMemoryBookingFilters(bookings, req.query);

        res.json({ success: true, bookings: filteredBookings });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tải danh sách đặt vé: " + error.message });
    }
};

export const exportBookingsCsv = async (req, res) => {
    try {
        const query = buildBookingQuery(req.query);
        const bookings = await Booking.find(query)
            .populate("user")
            .populate({
                path: "show",
                populate: [{ path: "movie" }, { path: "room" }]
            })
            .sort({ createdAt: -1 });

        const filteredBookings = applyInMemoryBookingFilters(bookings, req.query);
        const csv = serializeBookingsToCsv(filteredBookings);

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename=booking-report-${Date.now()}.csv`);
        res.send(csv);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi khi xuất báo cáo booking: " + error.message });
    }
};

export const cancelAdminBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const cancelReason = `${req.body?.cancelReason || ""}`.trim();

        if (!cancelReason) {
            return res.json({ success: false, message: "Vui lòng nhập lý do hủy booking." });
        }

        const booking = await Booking.findById(bookingId).populate("show");

        if (!booking) {
            return res.json({ success: false, message: "Không tìm thấy booking." });
        }

        if (!canAdminCancelBooking(booking)) {
            return res.json({
                success: false,
                message: "Booking này không còn đủ điều kiện để hủy."
            });
        }

        const result = await cancelBookingAndHandlePayment(booking, {
            actor: STATUS_ACTOR.ADMIN,
            cancelledBy: "ADMIN",
            reason: cancelReason
        });

        emitSeatsReleased(req, booking.show?._id || booking.show, result.releasedSeats || []);

        res.json({
            success: true,
            message: result.refund
                ? `Đã hủy booking và hoàn ${Math.round((result.refundRate || 0) * 100)}% vào ví QuickShow: ${(result.walletRefundAmount || 0).toLocaleString("vi-VN")} VND.`
                : "Đã hủy booking thành công.",
            refund: {
                amount: result.refundAmount || 0,
                stripeAmount: result.stripeRefundAmount || 0,
                walletAmount: result.walletRefundAmount || 0,
                stripeRefundId: result.stripeRefund?.id || "",
                feeAmount: result.refundFeeAmount || 0,
                rate: result.refundRate || 0,
                method: result.refundPolicy?.refundMethod || ""
            }
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi hủy booking: " + error.message });
    }
};

export const checkInBookingByCode = async (req, res) => {
    try {
        const bookingCode = `${req.body?.bookingCode || ""}`.trim().toUpperCase();

        if (!bookingCode) {
            return res.json({ success: false, message: "Vui lòng nhập mã booking." });
        }

        const booking = await Booking.findOne({ bookingCode }).populate("show").populate("user");

        if (!booking) {
            return res.json({ success: false, message: "Không tìm thấy booking với mã đã nhập." });
        }

        if (booking.bookingStatus === BOOKING_STATUS.CHECKED_IN) {
            return res.json({ success: false, message: "Booking này đã được check-in trước đó." });
        }

        if (!canCheckInBooking(booking, booking.show)) {
            return res.json({
                success: false,
                message: "Booking này không đủ điều kiện để check-in."
            });
        }

        const lifecycle = getShowtimeLifecycle(booking.show);
        if (lifecycle === "ENDED") {
            return res.json({ success: false, message: "Suất chiếu đã kết thúc, không thể check-in." });
        }

        const showTime = new Date(booking.showDateTime || booking.show?.showDateTime);
        const diffMinutes = (showTime.getTime() - Date.now()) / (1000 * 60);

        if (diffMinutes > 120) {
            return res.json({
                success: false,
                message: "Chỉ có thể check-in trong vòng 120 phút trước giờ chiếu."
            });
        }

        booking.checkedInAt = new Date();
        booking.checkedInBy = getAdminUserId(req);
        setBookingStatuses(booking, {
            bookingStatus: BOOKING_STATUS.CHECKED_IN,
            paymentStatus: PAYMENT_STATUS.PAID,
            actor: STATUS_ACTOR.ADMIN,
            isPaid: true,
            note: "Check-in bằng mã booking tại quầy."
        });
        await booking.save();

        res.json({
            success: true,
            message: "Check-in thành công.",
            booking: {
                bookingCode: booking.bookingCode,
                movieTitle: booking.movieTitle,
                roomName: booking.roomName,
                bookedSeats: booking.bookedSeats,
                userName: booking.user?.name || "Khách hàng"
            }
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi check-in booking: " + error.message });
    }
};
