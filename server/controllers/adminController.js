import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import User from "../models/User.js";
import Room, {
    buildSeatLayoutStats,
    ROOM_STATUSES,
    ROOM_TYPES,
    normalizeSeatMap
} from "../models/Room.js";

const buildErrorMessage = (fallbackMessage, error) => {
    if (error?.code === 11000) {
        return "Ten phong chieu da ton tai trong he thong.";
    }

    return `${fallbackMessage}: ${error.message}`;
};

const validateRoomPayload = (body, options = {}) => {
    const { requireName = false, requireSeatMap = false } = options;
    const payload = {};

    if (body.name !== undefined || requireName) {
        const name = `${body.name || ''}`.trim();
        if (!name) {
            throw new Error("Ten phong chieu khong duoc de trong.");
        }
        payload.name = name;
    }

    if (body.roomType !== undefined) {
        const roomType = `${body.roomType || ''}`.trim().toUpperCase();
        if (!ROOM_TYPES.includes(roomType)) {
            throw new Error("Loai phong chieu khong hop le.");
        }
        payload.roomType = roomType;
    }

    if (body.status !== undefined) {
        const status = `${body.status || ''}`.trim().toUpperCase();
        if (!ROOM_STATUSES.includes(status)) {
            throw new Error("Trang thai phong chieu khong hop le.");
        }
        payload.status = status;
    }

    if (body.maintenanceNote !== undefined || payload.status === 'MAINTENANCE') {
        const maintenanceNote = `${body.maintenanceNote || ''}`.trim();

        if (payload.status === 'MAINTENANCE' && !maintenanceNote) {
            throw new Error("Can nhap ly do bao tri khi chuyen phong sang trang thai bao tri.");
        }

        payload.maintenanceNote = maintenanceNote;
    }

    if (body.seatMap !== undefined || requireSeatMap) {
        payload.seatMap = normalizeSeatMap(body.seatMap);
    }

    return payload;
};

const getRoomUsage = async (roomId) => {
    const now = new Date();

    const [totalShowsCount, futureShowsCount, nextShow] = await Promise.all([
        Show.countDocuments({ room: roomId }),
        Show.countDocuments({ room: roomId, showDateTime: { $gte: now } }),
        Show.findOne({ room: roomId, showDateTime: { $gte: now } })
            .sort({ showDateTime: 1 })
            .select("showDateTime")
            .lean()
    ]);

    return {
        totalShowsCount,
        futureShowsCount,
        nextShowTime: nextShow?.showDateTime || null
    };
};

const enrichRoomsWithUsage = async (rooms) => {
    const now = new Date();
    const roomIds = rooms.map((room) => room._id);

    const [futureShows, totalShows] = await Promise.all([
        Show.aggregate([
            { $match: { room: { $in: roomIds }, showDateTime: { $gte: now } } },
            {
                $group: {
                    _id: "$room",
                    futureShowsCount: { $sum: 1 },
                    nextShowTime: { $min: "$showDateTime" }
                }
            }
        ]),
        Show.aggregate([
            { $match: { room: { $in: roomIds } } },
            {
                $group: {
                    _id: "$room",
                    totalShowsCount: { $sum: 1 }
                }
            }
        ])
    ]);

    const futureShowMap = new Map(
        futureShows.map((item) => [item._id.toString(), item])
    );
    const totalShowMap = new Map(
        totalShows.map((item) => [item._id.toString(), item.totalShowsCount])
    );

    return rooms.map((room) => {
        const futureShowData = futureShowMap.get(room._id.toString());

        return {
            ...room,
            status: room.status || 'ACTIVE',
            maintenanceNote: room.maintenanceNote || '',
            capacity: room.capacity ?? buildSeatLayoutStats(room.seatMap || []).capacity,
            futureShowsCount: futureShowData?.futureShowsCount || 0,
            nextShowTime: futureShowData?.nextShowTime || null,
            totalShowsCount: totalShowMap.get(room._id.toString()) || 0
        };
    });
};

const generateStandardMap = () => {
    const seatMap = [];
    const rows = ['A', 'B', 'SPACE1', 'C', 'D', 'E', 'SPACE2', 'F', 'G'];

    rows.forEach((rowLabel) => {
        if (rowLabel.startsWith('SPACE')) {
            seatMap.push({ row: rowLabel, seats: [] });
            return;
        }

        const seats = [];
        let type = 'STANDARD';
        if (['C', 'D', 'E'].includes(rowLabel)) type = 'VIP';
        if (['F', 'G'].includes(rowLabel)) type = 'COUPLE';

        for (let i = 1; i <= 8; i += 1) {
            if (['C', 'D', 'E', 'F', 'G'].includes(rowLabel) && i === 5) {
                seats.push({ seatNumber: `GAP-${rowLabel}`, seatType: 'EMPTY' });
            }
            seats.push({ seatNumber: `${rowLabel}${i}`, seatType: type });
        }

        seatMap.push({ row: rowLabel, seats });
    });

    return seatMap;
};

const generateIMAXMap = () => {
    const seatMap = [];
    const rows = ['A', 'B', 'C', 'SPACE1', 'D', 'E', 'F', 'G', 'SPACE2', 'H', 'I'];

    rows.forEach((rowLabel) => {
        if (rowLabel.startsWith('SPACE')) {
            seatMap.push({ row: rowLabel, seats: [] });
            return;
        }

        const seats = [];
        let type = 'STANDARD';
        if (['D', 'E', 'F', 'G'].includes(rowLabel)) type = 'VIP';
        if (['H', 'I'].includes(rowLabel)) type = 'COUPLE';

        for (let i = 1; i <= 10; i += 1) {
            if (['D', 'E', 'F', 'G', 'H', 'I'].includes(rowLabel) && i === 6) {
                seats.push({ seatNumber: `GAP-${rowLabel}`, seatType: 'EMPTY' });
            }
            seats.push({ seatNumber: `${rowLabel}${i}`, seatType: type });
        }

        seatMap.push({ row: rowLabel, seats });
    });

    return seatMap;
};

const generateGoldClassMap = () => {
    const seatMap = [];
    const rows = ['A', 'B', 'C', 'SPACE1', 'D', 'E'];

    rows.forEach((rowLabel) => {
        if (rowLabel.startsWith('SPACE')) {
            seatMap.push({ row: rowLabel, seats: [] });
            return;
        }

        const seats = [];
        let type = 'VIP';
        if (['D', 'E'].includes(rowLabel)) type = 'COUPLE';

        for (let i = 1; i <= 6; i += 1) {
            if (i === 4) {
                seats.push({ seatNumber: `GAP-${rowLabel}`, seatType: 'EMPTY' });
            }
            seats.push({ seatNumber: `${rowLabel}${i}`, seatType: type });
        }

        seatMap.push({ row: rowLabel, seats });
    });

    return seatMap;
};

export const isAdmin = async (req, res) => {
    res.json({ success: true, isAdmin: true });
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

        const activeShows = await Show.find({ showDateTime: { $gte: new Date() } })
            .populate('movie');

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
        res.json({ success: false, message: "Loi khi tai du lieu Dashboard: " + error.message });
    }
};

export const getAllShows = async (req, res) => {
    try {
        const shows = await Show.aggregate([
            { $match: { showDateTime: { $gte: new Date() } } },
            {
                $lookup: {
                    from: 'bookings',
                    localField: '_id',
                    foreignField: 'show',
                    as: 'bookingDetails'
                }
            },
            {
                $lookup: {
                    from: 'movies',
                    localField: 'movie',
                    foreignField: '_id',
                    as: 'movie'
                }
            },
            { $unwind: '$movie' },
            {
                $addFields: {
                    totalEarnings: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: "$bookingDetails",
                                        as: "booking",
                                        cond: { $eq: ["$$booking.isPaid", true] }
                                    }
                                },
                                as: "paidBooking",
                                in: "$$paidBooking.amount"
                            }
                        }
                    },
                    totalTickets: {
                        $size: {
                            $filter: {
                                input: "$bookingDetails",
                                as: "booking",
                                cond: { $eq: ["$$booking.isPaid", true] }
                            }
                        }
                    }
                }
            },
            { $project: { bookingDetails: 0 } },
            { $sort: { showDateTime: 1 } }
        ]);

        res.json({ success: true, shows });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Loi khi tai danh sach suat chieu: " + error.message });
    }
};

export const getAllBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({})
            .populate('user')
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
        await Room.deleteMany({});

        const roomsToCreate = [
            { name: "Cinema 1", roomType: "2D", seatMap: generateStandardMap() },
            { name: "Cinema 2", roomType: "2D", seatMap: generateStandardMap() },
            { name: "Cinema 3", roomType: "3D", seatMap: generateStandardMap() },
            { name: "IMAX 4", roomType: "IMAX", seatMap: generateIMAXMap() },
            { name: "Gold Class 5", roomType: "GOLD_CLASS", seatMap: generateGoldClassMap() },
            { name: "Sweetbox 6", roomType: "SWEETBOX", seatMap: generateGoldClassMap() }
        ];

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
                status: room.status || 'ACTIVE',
                maintenanceNote: room.maintenanceNote || '',
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
        const payload = validateRoomPayload(req.body, {
            requireName: true,
            requireSeatMap: true
        });

        const room = await Room.create(payload);

        res.json({
            success: true,
            message: "Da tao phong chieu thanh cong.",
            room
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: buildErrorMessage("Loi khi tao phong chieu", error) });
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

        const isSeatMapChanging = payload.seatMap !== undefined;
        const isRoomTypeChanging = payload.roomType && payload.roomType !== room.roomType;
        const isPuttingRoomUnavailable = payload.status && payload.status !== 'ACTIVE' && payload.status !== room.status;

        if ((isSeatMapChanging || isRoomTypeChanging) && usage.futureShowsCount > 0) {
            return res.json({
                success: false,
                message: "Khong the sua so do ghe hoac loai phong khi phong dang con suat chieu sap toi."
            });
        }

        if (isPuttingRoomUnavailable && usage.futureShowsCount > 0) {
            return res.json({
                success: false,
                message: "Can xu ly hoac huy cac suat chieu sap toi truoc khi dua phong vao bao tri/ngung khai thac."
            });
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
        res.json({ success: false, message: buildErrorMessage("Loi khi cap nhat phong chieu", error) });
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

        if (payload.status !== 'ACTIVE' && payload.status !== room.status && usage.futureShowsCount > 0) {
            return res.json({
                success: false,
                message: "Khong the doi trang thai phong khi van con suat chieu sap toi."
            });
        }

        room.status = payload.status;
        room.maintenanceNote = payload.maintenanceNote || '';
        await room.save();

        res.json({
            success: true,
            message: "Da cap nhat trang thai phong chieu thanh cong.",
            room
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: buildErrorMessage("Loi khi cap nhat trang thai phong chieu", error) });
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
