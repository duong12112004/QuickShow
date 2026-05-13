import express from "express";
import { protectAdmin } from "../middleware/auth.js";
import {
    createRoom,
    deleteRoom,
    getAllBookings,
    getAllRooms,
    getAllShows,
    getDashboardData,
    getRoomDetail,
    isAdmin,
    seedCinemaData,
    updateRoom,
    updateRoomStatus
} from "../controllers/adminController.js";

const adminRouter = express.Router();

adminRouter.get('/is-admin', protectAdmin, isAdmin);
adminRouter.get('/dashboard', protectAdmin, getDashboardData);
adminRouter.get('/all-shows', protectAdmin, getAllShows);
adminRouter.get('/all-bookings', protectAdmin, getAllBookings);
adminRouter.get('/seed', protectAdmin, seedCinemaData);
adminRouter.get('/rooms', protectAdmin, getAllRooms);
adminRouter.get('/rooms/:roomId', protectAdmin, getRoomDetail);
adminRouter.post('/rooms', protectAdmin, createRoom);
adminRouter.put('/rooms/:roomId', protectAdmin, updateRoom);
adminRouter.patch('/rooms/:roomId/status', protectAdmin, updateRoomStatus);
adminRouter.delete('/rooms/:roomId', protectAdmin, deleteRoom);

export default adminRouter;
