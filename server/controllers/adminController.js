import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import User from "../models/User.js";
import Room from '../models/Room.js';

// Kiểm tra quyền Admin
export const isAdmin = async (req, res) => {
    res.json({ success: true, isAdmin: true });
}

// Lấy dữ liệu tổng quan cho trang Dashboard
export const getDashboardData = async (req, res) => {
    try {
        // Sử dụng Aggregation để tính tổng doanh thu và số lượng vé từ các đơn đã thanh toán
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

        // Lấy các suất chiếu sắp tới và thông tin phim tương ứng
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
        res.json({ success: false, message: "Lỗi khi tải dữ liệu Dashboard: " + error.message });
    }
};

// Lấy danh sách tất cả các suất chiếu kèm doanh thu thực tế
export const getAllShows = async (req, res) => {
    try {
        // Sử dụng Aggregation để tự động tính doanh thu dựa trên các booking đã thanh toán
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
            { $unwind: '$movie' }, // Giải nén mảng movie thành một object
            {
                $addFields: {
                    // Tính tổng tiền từ các hóa đơn đã thanh toán của suất chiếu này
                    totalEarnings: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: "$bookingDetails",
                                        as: "b",
                                        cond: { $eq: ["$$b.isPaid", true] }
                                    }
                                },
                                as: "paidB",
                                in: "$$paidB.amount"
                            }
                        }
                    },
                    // Đếm số lượng vé đã thanh toán
                    totalTickets: {
                        $size: {
                            $filter: {
                                input: "$bookingDetails",
                                as: "b",
                                cond: { $eq: ["$$b.isPaid", true] }
                            }
                        }
                    }
                }
            },
            { $project: { bookingDetails: 0 } }, // Xóa trường dữ liệu tạm để tối ưu response
            { $sort: { showDateTime: 1 } }
        ]);

        res.json({ success: true, shows });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tải danh sách suất chiếu: " + error.message });
    }
};

// Lấy danh sách lịch sử đặt vé (Bookings)
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
        res.json({ success: false, message: "Lỗi khi tải danh sách đặt vé: " + error.message });
    }
};

// Khởi tạo dữ liệu phòng chiếu mẫu (Seed data)
export const seedCinemaData = async (req, res) => {
    try {
        // Xóa dữ liệu phòng chiếu cũ trước khi tạo mới
        await Room.deleteMany({});

        // --- CÁC HÀM TẠO SƠ ĐỒ GHẾ ---

        // Sơ đồ phòng Tiêu chuẩn (Standard) - 8 cột
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

        // Sơ đồ phòng IMAX - 10 cột
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

        // Sơ đồ phòng Gold Class (Chỉ có VIP và COUPLE) - 6 cột
        const generateGoldClassMap = () => {
            const seatMap = [];
            const rows = ['A', 'B', 'C', 'SPACE1', 'D', 'E'];
            rows.forEach(rowLabel => {
                if (rowLabel.startsWith('SPACE')) return seatMap.push({ row: rowLabel, seats: [] });
                const seats = [];
                let type = 'VIP'; 
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

        // --- DANH SÁCH CÁC PHÒNG CHIẾU SẼ TẠO ---
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
            message: "Đã khởi tạo thành công dữ liệu cho 6 phòng chiếu!",
            rooms: newRooms
        });

    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tạo dữ liệu phòng chiếu: " + error.message });
    }
};

// Lấy danh sách các phòng chiếu
export const getAllRooms = async (req, res) => {
    try {
        const rooms = await Room.find().sort({ name: 1 });
        res.json({ success: true, rooms });
    } catch (error) {
        res.json({ success: false, message: "Lỗi khi tải danh sách phòng chiếu: " + error.message });
    }
};