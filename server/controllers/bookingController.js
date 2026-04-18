import { inngest } from "../inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import stripe from 'stripe';

// Kiểm tra tình trạng ghế trống của suất chiếu
const checkSeatsAvailability = async (showId, selectedSeats) => {
    try {
        const showData = await Show.findById(showId);
        if (!showData) return false;

        const isAnySeatTaken = selectedSeats.some(seat => 
            showData.occupiedSeats[seat] || showData.heldSeats[seat]
        );

        return !isAnySeatTaken;
    } catch (error) {
        console.log(error.message);
        return false;
    }
};

// Xử lý logic đặt vé và tạo phiên thanh toán Stripe
export const createBooking = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { showId, selectedSeats } = req.body;
        const { origin } = req.headers;

        const isAvailable = await checkSeatsAvailability(showId, selectedSeats);
        if (!isAvailable) {
            return res.json({ success: false, message: "Ghế bạn chọn đã có người đặt hoặc đang được giữ." });
        }

        const showData = await Show.findById(showId).populate('movie').populate('room');
        if (!showData || !showData.room) {
            return res.json({ success: false, message: "Lỗi truy xuất dữ liệu suất chiếu hoặc phòng." });
        }

        // Tính toán tổng tiền vé tại Backend dựa trên loại ghế để đảm bảo tính toàn vẹn dữ liệu
        const seatMap = showData.room.seatMap;
        const basePrice = showData.basePrice;
        let totalAmount = 0;

        selectedSeats.forEach(seatNum => {
            let seatType = 'STANDARD';
            seatMap.forEach(row => {
                row.seats.forEach(s => {
                    if (s.seatNumber === seatNum) seatType = s.seatType;
                });
            });

            if (seatType === 'VIP') totalAmount += (basePrice + 20000);
            else if (seatType === 'COUPLE') totalAmount += (basePrice * 2);
            else totalAmount += basePrice;
        });

        // Tạo bản ghi hóa đơn mới
        const booking = await Booking.create({
            user: userId,
            show: showId,
            roomName: showData.room.name,
            amount: totalAmount,
            bookedSeats: selectedSeats
        });

        // Đưa ghế vào trạng thái chờ để khóa tạm thời trong quá trình người dùng thanh toán
        selectedSeats.forEach((seat) => {
            showData.heldSeats[seat] = userId; 
        });
        showData.markModified('heldSeats');
        await showData.save();

        // Khởi tạo phiên giao dịch Stripe
        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
        const line_items = [{
            price_data: {
                currency: 'vnd',
                product_data: { name: showData.movie.title },
                unit_amount: Math.floor(booking.amount)
            },
            quantity: 1
        }];

        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/loading/my-bookings`,
            cancel_url: `${origin}/my-bookings`,
            line_items: line_items,
            mode: 'payment',
            metadata: { bookingId: booking._id.toString() },
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        });

        booking.paymentLink = session.url;
        await booking.save();

        // Đẩy task vào hàng đợi Inngest để background job tự động kiểm tra trạng thái thanh toán
        await inngest.send({
            name: "app/checkpayment",
            data: { bookingId: booking._id.toString() }
        });

        res.json({ success: true, url: session.url });

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: "Đã xảy ra lỗi trong quá trình đặt vé: " + error.message });
    }
};

// Lấy danh sách các ghế đã được đặt thành công
export const getOccupiedSeats = async (req, res) => {
    try {
        const { showId } = req.params;
        const showData = await Show.findById(showId);
        const occupiedSeats = Object.keys(showData.occupiedSeats);
        res.json({ success: true, occupiedSeats });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: "Lỗi khi lấy dữ liệu ghế ngồi: " + error.message });
    }
};