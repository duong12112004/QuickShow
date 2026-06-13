import express from 'express';
import { createBooking, getOccupiedSeats } from '../controllers/bookingController.js';

const bookingRouter = express.Router();

// Tạo booking, giữ ghế và khởi tạo phiên thanh toán.
bookingRouter.post('/create', createBooking);
// Lấy các ghế đã bán của một suất chiếu để FE cập nhật trạng thái ghế.
bookingRouter.get('/seats/:showId', getOccupiedSeats);

export default bookingRouter;
