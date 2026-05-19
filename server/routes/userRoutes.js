import express from "express";
import { cancelMyBooking, confirmMyBookingPayment, getFavorites, getMyWallet, getUserBookings, updateFavorite } from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.get('/bookings', getUserBookings);
userRouter.get('/wallet', getMyWallet);
userRouter.post('/bookings/confirm-payment', confirmMyBookingPayment);
userRouter.post('/bookings/:bookingId/cancel', cancelMyBooking);
userRouter.post('/update-favorite', updateFavorite);
userRouter.get('/favorites', getFavorites);

export default userRouter;
