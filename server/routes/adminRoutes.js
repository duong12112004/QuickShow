import express from "express";
import { protectAdmin } from "../middleware/auth.js";
import { getAllBookings, getAllShows, getDashboardData, isAdmin, seedCinemaData, getAllRooms } from "../controllers/adminController.js";

const adminRouter = express.Router();

adminRouter.get('/is-admin', protectAdmin, isAdmin);
adminRouter.get('/dashboard', protectAdmin, getDashboardData);
adminRouter.get('/all-shows', protectAdmin, getAllShows);
adminRouter.get('/all-bookings', protectAdmin, getAllBookings);
adminRouter.get('/seed', protectAdmin, seedCinemaData);
adminRouter.get('/rooms', getAllRooms)
export default adminRouter;