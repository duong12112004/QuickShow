import express from "express";
import { protectAdmin } from "../middleware/auth.js";
import {
    cancelShowtime,
    createShowtime,
    deleteShowtime,
    getAllBookings,
    getAdminShowtimes,
    getDashboardData,
    isAdmin,
    updateShowtime,
} from "../controllers/adminController.js";
import {
    createRoom,
    deleteRoom,
    getAllRooms,
    getRoomDetail,
    seedCinemaData,
    updateRoom,
    updateRoomStatus
} from "../controllers/roomController.js";

const adminRouter = express.Router();

adminRouter.get('/is-admin', protectAdmin, isAdmin);
adminRouter.get('/dashboard', protectAdmin, getDashboardData);
adminRouter.get('/showtimes', protectAdmin, getAdminShowtimes);
adminRouter.get('/all-shows', protectAdmin, getAdminShowtimes);
adminRouter.post('/showtimes', protectAdmin, createShowtime);
adminRouter.put('/showtimes/:showId', protectAdmin, updateShowtime);
adminRouter.patch('/showtimes/:showId/cancel', protectAdmin, cancelShowtime);
adminRouter.delete('/showtimes/:showId', protectAdmin, deleteShowtime);
adminRouter.get('/all-bookings', protectAdmin, getAllBookings);
adminRouter.get('/seed', protectAdmin, seedCinemaData);
adminRouter.get('/rooms', protectAdmin, getAllRooms);
adminRouter.get('/rooms/:roomId', protectAdmin, getRoomDetail);
adminRouter.post('/rooms', protectAdmin, createRoom);
adminRouter.put('/rooms/:roomId', protectAdmin, updateRoom);
adminRouter.patch('/rooms/:roomId/status', protectAdmin, updateRoomStatus);
adminRouter.delete('/rooms/:roomId', protectAdmin, deleteRoom);

export default adminRouter;
