import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import User from "../models/User.js";
import { inngest } from "../inngest/index.js";
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

export const isAdmin = async (req, res) => {
    res.json({ success: true, isAdmin: true });
};

const buildRevenueMap = async (showIds) => {
    if (showIds.length === 0) {
        return new Map();
    }

    const rows = await Booking.aggregate([
        {
            $match: {
                show: { $in: showIds },
                isPaid: true
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

export const getDashboardData = async (req, res) => {
    try {
        const stats = await Booking.aggregate([
            { $match: { isPaid: true } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$amount" },
                    totalBookings: { $sum: 1 }
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
            totalBookings: stats[0]?.totalBookings || 0,
            totalRevenue: stats[0]?.totalRevenue || 0,
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

        const paidBookingsCount = await Booking.countDocuments({
            show: showtime._id,
            isPaid: true
        });

        if (paidBookingsCount > 0) {
            return res.json({
                success: false,
                message: "Không thể hủy suất chiếu đã có vé thanh toán."
            });
        }

        showtime.status = SHOWTIME_STATUS.CANCELLED;
        showtime.cancellationReason = cancellationReason;
        showtime.cancelledAt = new Date();
        showtime.heldSeats = {};
        showtime.markModified("heldSeats");
        await showtime.save();

        res.json({ success: true, message: "Đã hủy suất chiếu thành công." });
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
        const bookings = await Booking.find({})
            .populate("user")
            .populate({
                path: "show",
                populate: { path: "movie" }
            })
            .sort({ createdAt: -1 });

        res.json({ success: true, bookings });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tải danh sách đặt vé: " + error.message });
    }
};
