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

adminRouter.get('/is-admin', protectAdmin, isAdmin);
adminRouter.get('/dashboard', protectAdmin, getDashboardData);
adminRouter.get('/showtimes', protectAdmin, getAdminShowtimes);
adminRouter.get('/all-shows', protectAdmin, getAdminShowtimes);
adminRouter.post('/showtimes', protectAdmin, createShowtime);
adminRouter.put('/showtimes/:showId', protectAdmin, updateShowtime);
adminRouter.patch('/showtimes/:showId/cancel', protectAdmin, cancelShowtime);
adminRouter.delete('/showtimes/:showId', protectAdmin, deleteShowtime);
adminRouter.get('/bookings/export', protectAdmin, exportBookingsCsv);
adminRouter.get('/bookings', protectAdmin, getAllBookings);
adminRouter.post('/bookings/check-in', protectAdmin, checkInBookingByCode);
adminRouter.post('/bookings/check-in/qr', protectAdmin, checkInBookingByQr);
adminRouter.patch('/bookings/:bookingId/cancel', protectAdmin, cancelAdminBooking);
adminRouter.get('/all-bookings', protectAdmin, getAllBookings);
adminRouter.get('/reviews', protectAdmin, getAdminReviews);
adminRouter.patch('/reviews/:reviewId/hide', protectAdmin, hideReview);
adminRouter.patch('/reviews/:reviewId/restore', protectAdmin, restoreReview);
adminRouter.get('/concessions', protectAdmin, getAdminConcessions);
adminRouter.post('/concessions', protectAdmin, createConcession);
adminRouter.put('/concessions/:concessionId', protectAdmin, updateConcession);
adminRouter.delete('/concessions/:concessionId', protectAdmin, deleteConcession);
adminRouter.get('/seed', protectAdmin, seedCinemaData);
adminRouter.get('/rooms', protectAdmin, getAllRooms);
adminRouter.get('/rooms/:roomId', protectAdmin, getRoomDetail);
adminRouter.post('/rooms', protectAdmin, createRoom);
adminRouter.put('/rooms/:roomId', protectAdmin, updateRoom);
adminRouter.patch('/rooms/:roomId/status', protectAdmin, updateRoomStatus);
adminRouter.delete('/rooms/:roomId', protectAdmin, deleteRoom);

export default adminRouter;
