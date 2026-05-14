import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import User from "../models/User.js";
import Room from "../models/Room.js";
import {
    buildRoomErrorMessage,
    buildSeatLayoutStats,
    enrichRoomsWithUsage,
    generateSeatMapByRoomType,
    getRoomUsage,
    validateRoomPayload
} from "../services/roomService.js";
import {
    assertNoShowtimeOverlap,
    assertNoLocalShowtimeOverlap,
    assertShowtimeNotInPast,
    buildShowtimeSnapshot,
    ensureMovieExists,
    ensureRoomIsActive,
    getShowtimeLifecycle,
    hasBookingsOrHeldSeats,
    SHOWTIME_STATUS,
    serializeAdminShowtime
} from "../services/showtimeService.js";
import {
    validateCancelShowtimePayload,
    validateCreateShowtimePayload,
    validateUpdateShowtimePayload
} from "../validators/showtimeValidator.js";

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
            status: SHOWTIME_STATUS.SCHEDULED
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
        res.json({ success: false, message: "Loi khi tai du lieu dashboard: " + error.message });
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
        res.json({ success: false, message: "Loi khi tai danh sach suat chieu: " + error.message });
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

        res.json({
            success: true,
            message: docs.length > 1 ? "Da tao cac suat chieu thanh cong." : "Da tao suat chieu thanh cong.",
            showtimes: created
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Loi khi tao suat chieu: " + error.message });
    }
};

export const updateShowtime = async (req, res) => {
    try {
        const { showId } = req.params;
        const updates = validateUpdateShowtimePayload(req.body);
        const showtime = await Show.findById(showId).populate("movie").populate("room");

        if (!showtime) {
            return res.json({ success: false, message: "Suat chieu khong ton tai." });
        }

        if ((showtime.status || SHOWTIME_STATUS.SCHEDULED) === SHOWTIME_STATUS.CANCELLED) {
            return res.json({ success: false, message: "Suat chieu da huy khong the chinh sua." });
        }

        const lifecycle = getShowtimeLifecycle(showtime);
        if (lifecycle !== "UPCOMING") {
            return res.json({ success: false, message: "Chi co the sua suat chieu sap toi." });
        }

        if (hasBookingsOrHeldSeats(showtime)) {
            return res.json({
                success: false,
                message: "Suat chieu da co ve ban ra hoac dang giu cho. Hay huy suat thay vi chinh sua."
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

        res.json({ success: true, message: "Da cap nhat suat chieu thanh cong." });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Loi khi cap nhat suat chieu: " + error.message });
    }
};

export const cancelShowtime = async (req, res) => {
    try {
        const { showId } = req.params;
        const { cancellationReason } = validateCancelShowtimePayload(req.body);
        const showtime = await Show.findById(showId);

        if (!showtime) {
            return res.json({ success: false, message: "Suat chieu khong ton tai." });
        }

        if ((showtime.status || SHOWTIME_STATUS.SCHEDULED) === SHOWTIME_STATUS.CANCELLED) {
            return res.json({ success: false, message: "Suat chieu nay da duoc huy truoc do." });
        }

        const lifecycle = getShowtimeLifecycle(showtime);
        if (lifecycle === "ENDED") {
            return res.json({ success: false, message: "Khong the huy suat chieu da ket thuc." });
        }

        showtime.status = SHOWTIME_STATUS.CANCELLED;
        showtime.cancellationReason = cancellationReason;
        showtime.cancelledAt = new Date();
        showtime.heldSeats = {};
        showtime.markModified("heldSeats");
        await showtime.save();

        res.json({ success: true, message: "Da huy suat chieu thanh cong." });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Loi khi huy suat chieu: " + error.message });
    }
};

export const deleteShowtime = async (req, res) => {
    try {
        const { showId } = req.params;
        const showtime = await Show.findById(showId);

        if (!showtime) {
            return res.json({ success: false, message: "Suat chieu khong ton tai." });
        }

        if (hasBookingsOrHeldSeats(showtime)) {
            return res.json({
                success: false,
                message: "Khong the xoa suat chieu da co ve ban ra hoac dang giu cho."
            });
        }

        const lifecycle = getShowtimeLifecycle(showtime);
        if (lifecycle !== "UPCOMING" && lifecycle !== "CANCELLED") {
            return res.json({ success: false, message: "Chi co the xoa suat chieu chua dien ra." });
        }

        await Show.findByIdAndDelete(showId);

        res.json({ success: true, message: "Da xoa suat chieu thanh cong." });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Loi khi xoa suat chieu: " + error.message });
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
        res.json({ success: false, message: "Loi khi tai danh sach dat ve: " + error.message });
    }
};

export const seedCinemaData = async (req, res) => {
    try {
        const totalShowsCount = await Show.countDocuments();

        if (totalShowsCount > 0) {
            return res.json({
                success: false,
                message: "Khong the seed lai phong chieu khi he thong da co suat chieu. Hay dung tren moi truong dev sach."
            });
        }

        await Room.deleteMany({});

        const roomTypesToSeed = [
            { name: "Cinema 1", roomType: "2D" },
            { name: "Cinema 2", roomType: "2D" },
            { name: "Cinema 3", roomType: "3D" },
            { name: "IMAX 4", roomType: "IMAX" },
            { name: "Gold Class 5", roomType: "GOLD_CLASS" },
            { name: "Sweetbox 6", roomType: "SWEETBOX" }
        ];

        const roomsToCreate = roomTypesToSeed.map((room) => ({
            ...room,
            seatMap: generateSeatMapByRoomType(room.roomType)
        }));

        const newRooms = await Room.insertMany(roomsToCreate);

        res.json({
            success: true,
            message: "Da khoi tao thanh cong du lieu cho 6 phong chieu.",
            rooms: newRooms
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Loi khi tao du lieu phong chieu: " + error.message });
    }
};

export const getAllRooms = async (req, res) => {
    try {
        const rooms = await Room.find({})
            .sort({ name: 1 })
            .lean();

        const roomsWithUsage = await enrichRoomsWithUsage(rooms);

        res.json({ success: true, rooms: roomsWithUsage });
    } catch (error) {
        res.json({ success: false, message: "Loi khi tai danh sach phong chieu: " + error.message });
    }
};

export const getRoomDetail = async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await Room.findById(roomId).lean();

        if (!room) {
            return res.json({ success: false, message: "Phong chieu khong ton tai." });
        }

        const usage = await getRoomUsage(roomId);

        res.json({
            success: true,
            room: {
                ...room,
                status: room.status || "ACTIVE",
                maintenanceNote: room.maintenanceNote || "",
                capacity: room.capacity ?? buildSeatLayoutStats(room.seatMap || []).capacity,
                ...usage,
                canEditSeatMap: usage.futureShowsCount === 0,
                canDelete: usage.totalShowsCount === 0
            }
        });
    } catch (error) {
        res.json({ success: false, message: "Loi khi tai chi tiet phong chieu: " + error.message });
    }
};

export const createRoom = async (req, res) => {
    try {
        const payload = validateRoomPayload(req.body, { requireName: true });
        payload.seatMap = generateSeatMapByRoomType(payload.roomType || "2D");

        const room = await Room.create(payload);

        res.json({
            success: true,
            message: "Da tao phong chieu thanh cong.",
            room
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: buildRoomErrorMessage("Loi khi tao phong chieu", error) });
    }
};

export const updateRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await Room.findById(roomId);

        if (!room) {
            return res.json({ success: false, message: "Phong chieu khong ton tai." });
        }

        const payload = validateRoomPayload(req.body);
        const usage = await getRoomUsage(roomId);

        const isSeatMapChanging = req.body.seatMap !== undefined;
        const isRoomTypeChanging = payload.roomType && payload.roomType !== room.roomType;
        const isPuttingRoomUnavailable = payload.status && payload.status !== "ACTIVE" && payload.status !== room.status;
        const shouldRegenerateSeatMap = isSeatMapChanging || isRoomTypeChanging;

        if (shouldRegenerateSeatMap && usage.futureShowsCount > 0) {
            return res.json({
                success: false,
                message: "Khong the sua so do ghe hoac loai phong khi phong dang con suat chieu sap toi."
            });
        }

        if (isPuttingRoomUnavailable && usage.futureShowsCount > 0) {
            return res.json({
                success: false,
                message: "Can xu ly hoac huy cac suat chieu sap toi truoc khi dua phong vao bao tri hoac ngung khai thac."
            });
        }

        if (shouldRegenerateSeatMap) {
            payload.seatMap = generateSeatMapByRoomType(payload.roomType || room.roomType);
        }

        Object.assign(room, payload);
        await room.save();

        res.json({
            success: true,
            message: "Da cap nhat phong chieu thanh cong.",
            room
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: buildRoomErrorMessage("Loi khi cap nhat phong chieu", error) });
    }
};

export const updateRoomStatus = async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await Room.findById(roomId);

        if (!room) {
            return res.json({ success: false, message: "Phong chieu khong ton tai." });
        }

        const payload = validateRoomPayload(req.body);

        if (!payload.status) {
            return res.json({ success: false, message: "Trang thai phong chieu la truong bat buoc." });
        }

        const usage = await getRoomUsage(roomId);

        if (payload.status !== "ACTIVE" && payload.status !== room.status && usage.futureShowsCount > 0) {
            return res.json({
                success: false,
                message: "Khong the doi trang thai phong khi van con suat chieu sap toi."
            });
        }

        room.status = payload.status;
        room.maintenanceNote = payload.maintenanceNote || "";
        await room.save();

        res.json({
            success: true,
            message: "Da cap nhat trang thai phong chieu thanh cong.",
            room
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: buildRoomErrorMessage("Loi khi cap nhat trang thai phong chieu", error) });
    }
};

export const deleteRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await Room.findById(roomId);

        if (!room) {
            return res.json({ success: false, message: "Phong chieu khong ton tai." });
        }

        const usage = await getRoomUsage(roomId);

        if (usage.totalShowsCount > 0) {
            return res.json({
                success: false,
                message: "Khong the xoa phong da tung duoc gan voi suat chieu. Hay chuyen sang INACTIVE de ngung khai thac."
            });
        }

        await Room.findByIdAndDelete(roomId);

        res.json({
            success: true,
            message: "Da xoa phong chieu thanh cong."
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Loi khi xoa phong chieu: " + error.message });
    }
};
