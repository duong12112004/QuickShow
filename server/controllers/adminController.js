import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import User from "../models/User.js";
import Room from '../models/Room.js';

// API to check if user is admin
export const isAdmin = async (req, res) => {
    res.json({ success: true, isAdmin: true });
}

// API to get dashboard data
export const getDashboardData = async (req, res) => {
    try {
        const bookings = await Booking.find({ isPaid: true });
        const activeShows = await Show.find({ showDateTime: { $gte: new Date() } })
            .populate('movie');

        const totalUser = await User.countDocuments();

        const dashboardData = {
            totalBookings: bookings.length,
            totalRevenue: bookings.reduce((acc, booking) => acc + booking.amount, 0),
            activeShows,
            totalUser
        };

        res.json({ success: true, dashboardData });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// API to get all shows
export const getAllShows = async (req, res) => {
    try {
        const shows = await Show.find({ showDateTime: { $gte: new Date() } })
            .populate('movie')
            .sort({ showDateTime: 1 });
        res.json({ success: true, shows });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// API to get all bookings
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
        res.json({ success: false, message: error.message });
    }
};

export const seedCinemaData = async (req, res) => {
    try {
        // --- 0. DỌN SẠCH DỮ LIỆU CŨ ---
        await Room.deleteMany({});

        // --- 1. CÁC HÀM TẠO SƠ ĐỒ GHẾ ĐA DẠNG ---

        // Loại 1: Sơ đồ Tiêu chuẩn (8 cột)
        const generateStandardMap = () => {
            const seatMap = [];
            const rows = ['A', 'B', 'SPACE1', 'C', 'D', 'E', 'SPACE2', 'F', 'G'];
            rows.forEach(rowLabel => {
                if (rowLabel.startsWith('SPACE')) return seatMap.push({ row: rowLabel, seats: [] });
                const seats = [];
                let type = 'STANDARD';
                if (['C', 'D', 'E'].includes(rowLabel)) type = 'VIP';
                if (['F', 'G'].includes(rowLabel)) type = 'COUPLE';

                for (let i = 1; i <= 8; i++) {
                    if (['C', 'D', 'E', 'F', 'G'].includes(rowLabel) && i === 5) {
                        seats.push({ seatNumber: `GAP-${rowLabel}`, seatType: 'EMPTY' });
                    }
                    seats.push({ seatNumber: `${rowLabel}${i}`, seatType: type });
                }
                seatMap.push({ row: rowLabel, seats: seats });
            });
            return seatMap;
        };

        // Loại 2: Sơ đồ IMAX siêu lớn (10 cột)
        const generateIMAXMap = () => {
            const seatMap = [];
            const rows = ['A', 'B', 'C', 'SPACE1', 'D', 'E', 'F', 'G', 'SPACE2', 'H', 'I'];
            rows.forEach(rowLabel => {
                if (rowLabel.startsWith('SPACE')) return seatMap.push({ row: rowLabel, seats: [] });
                const seats = [];
                let type = 'STANDARD';
                if (['D', 'E', 'F', 'G'].includes(rowLabel)) type = 'VIP';
                if (['H', 'I'].includes(rowLabel)) type = 'COUPLE';

                for (let i = 1; i <= 10; i++) {
                    if (['D', 'E', 'F', 'G', 'H', 'I'].includes(rowLabel) && i === 6) {
                        seats.push({ seatNumber: `GAP-${rowLabel}`, seatType: 'EMPTY' });
                    }
                    seats.push({ seatNumber: `${rowLabel}${i}`, seatType: type });
                }
                seatMap.push({ row: rowLabel, seats: seats });
            });
            return seatMap;
        };

        // Loại 3: Sơ đồ Gold Class siêu VIP (6 cột, không có ghế thường)
        const generateGoldClassMap = () => {
            const seatMap = [];
            const rows = ['A', 'B', 'C', 'SPACE1', 'D', 'E'];
            rows.forEach(rowLabel => {
                if (rowLabel.startsWith('SPACE')) return seatMap.push({ row: rowLabel, seats: [] });
                const seats = [];
                let type = 'VIP'; // Mặc định là VIP
                if (['D', 'E'].includes(rowLabel)) type = 'COUPLE';

                for (let i = 1; i <= 6; i++) {
                    if (['A', 'B', 'C', 'D', 'E'].includes(rowLabel) && i === 4) {
                        seats.push({ seatNumber: `GAP-${rowLabel}`, seatType: 'EMPTY' });
                    }
                    seats.push({ seatNumber: `${rowLabel}${i}`, seatType: type });
                }
                seatMap.push({ row: rowLabel, seats: seats });
            });
            return seatMap;
        };

        // --- 2. XÂY DỰNG 6 PHÒNG CHIẾU ---
        const roomsToCreate = [
            { name: "Cinema 1", roomType: "2D", seatMap: generateStandardMap() },
            { name: "Cinema 2", roomType: "2D", seatMap: generateStandardMap() },
            { name: "Cinema 3", roomType: "3D", seatMap: generateStandardMap() },
            { name: "IMAX 4", roomType: "IMAX", seatMap: generateIMAXMap() },
            { name: "Gold Class 5", roomType: "2D", seatMap: generateGoldClassMap() },
            { name: "Sweetbox 6", roomType: "2D", seatMap: generateGoldClassMap() }
        ];

        const newRooms = await Room.insertMany(roomsToCreate);

        res.json({
            success: true,
            message: "Đã hoàn tất xây dựng tổ hợp 6 Phòng chiếu đa dạng!",
            rooms: newRooms
        });

    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

export const getAllRooms = async (req, res) => {
    try {
        // Lấy danh sách phòng trực tiếp
        const rooms = await Room.find().sort({ name: 1 });
        res.json({ success: true, rooms });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};