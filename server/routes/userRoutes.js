import express from "express";
import { cancelMyBooking, confirmMyBookingPayment, getFavorites, getMyBookingQr, getMyWallet, getUserBookings, updateFavorite } from "../controllers/userController.js";

const userRouter = express.Router();

// Lịch sử booking, QR check-in và thao tác hủy vé của người dùng hiện tại.
userRouter.get('/bookings', getUserBookings);
userRouter.get('/bookings/:bookingId/qr', getMyBookingQr);

// Số dư và lịch sử giao dịch ví QuickShow.
userRouter.get('/wallet', getMyWallet);

userRouter.post('/bookings/confirm-payment', confirmMyBookingPayment);
userRouter.post('/bookings/:bookingId/cancel', cancelMyBooking);

// Bật/tắt phim yêu thích và lấy danh sách phim yêu thích từ Clerk.
userRouter.post('/update-favorite', updateFavorite);
userRouter.get('/favorites', getFavorites);

export default userRouter;
