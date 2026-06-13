import express from "express";
import { protectAdmin } from "../middleware/auth.js";
import {
    cancelAdminBooking,
    cancelShowtime,
    checkInBookingByCode,
    checkInBookingByQr,
    createShowtime,
    exportBookingsCsv,
    deleteShowtime,
    getAllBookings,
    getAdminShowtimes,
    getDashboardData,
    isAdmin,
    updateShowtime,
} from "../controllers/adminController.js";
import { getAdminReviews, hideReview, restoreReview } from "../controllers/reviewController.js";
import {
    createRoom,
    deleteRoom,
    getAllRooms,
    getRoomDetail,
    seedCinemaData,
    updateRoom,
    updateRoomStatus
} from "../controllers/roomController.js";
import {
    createConcession,
    deleteConcession,
    getAdminConcessions,
    updateConcession
} from "../controllers/concessionController.js";

const adminRouter = express.Router();

// Tất cả endpoint trong router này đều qua protectAdmin để xác thực quyền quản trị.
// Kiểm tra quyền và lấy dữ liệu tổng quan cho dashboard.
adminRouter.get('/is-admin', protectAdmin, isAdmin);
adminRouter.get('/dashboard', protectAdmin, getDashboardData);

// Quản lý suất chiếu: xem danh sách, tạo, sửa, hủy mềm và xóa hẳn.
adminRouter.get('/showtimes', protectAdmin, getAdminShowtimes);
// Route cũ được giữ để tương thích với FE hoặc client chưa chuyển sang /showtimes.
adminRouter.get('/all-shows', protectAdmin, getAdminShowtimes);
adminRouter.post('/showtimes', protectAdmin, createShowtime);
adminRouter.put('/showtimes/:showId', protectAdmin, updateShowtime);
adminRouter.patch('/showtimes/:showId/cancel', protectAdmin, cancelShowtime);
adminRouter.delete('/showtimes/:showId', protectAdmin, deleteShowtime);

// Quản lý booking: xuất báo cáo, xem danh sách, check-in và hủy booking.
adminRouter.get('/bookings/export', protectAdmin, exportBookingsCsv);
adminRouter.get('/bookings', protectAdmin, getAllBookings);
adminRouter.post('/bookings/check-in', protectAdmin, checkInBookingByCode);
adminRouter.post('/bookings/check-in/qr', protectAdmin, checkInBookingByQr);
adminRouter.patch('/bookings/:bookingId/cancel', protectAdmin, cancelAdminBooking);
// Route cũ được giữ để tương thích với FE hoặc client chưa chuyển sang /bookings.
adminRouter.get('/all-bookings', protectAdmin, getAllBookings);

// Kiểm duyệt đánh giá của người dùng.
adminRouter.get('/reviews', protectAdmin, getAdminReviews);
adminRouter.patch('/reviews/:reviewId/hide', protectAdmin, hideReview);
adminRouter.patch('/reviews/:reviewId/restore', protectAdmin, restoreReview);

// Quản lý danh mục món ăn và combo bán kèm vé.
adminRouter.get('/concessions', protectAdmin, getAdminConcessions);
adminRouter.post('/concessions', protectAdmin, createConcession);
adminRouter.put('/concessions/:concessionId', protectAdmin, updateConcession);
adminRouter.delete('/concessions/:concessionId', protectAdmin, deleteConcession);

// Khởi tạo dữ liệu phòng mẫu và quản lý phòng chiếu.
adminRouter.get('/seed', protectAdmin, seedCinemaData);
adminRouter.get('/rooms', protectAdmin, getAllRooms);
adminRouter.get('/rooms/:roomId', protectAdmin, getRoomDetail);
adminRouter.post('/rooms', protectAdmin, createRoom);
adminRouter.put('/rooms/:roomId', protectAdmin, updateRoom);
adminRouter.patch('/rooms/:roomId/status', protectAdmin, updateRoomStatus);
adminRouter.delete('/rooms/:roomId', protectAdmin, deleteRoom);

export default adminRouter;
