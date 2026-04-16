
import { inngest } from "../inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import stripe from 'stripe'


// Hàm kiểm tra xem các chỗ ngồi đã chọn có còn trống cho một bộ phim hay không
const checkSeatsAvailability = async (showId, selectedSeats) => {
    try {
        const showData = await Show.findById(showId);
        if (!showData) return false;

        const occupiedSeats = showData.occupiedSeats;

        const isAnySeatTaken = selectedSeats.some(seat => 
            showData.occupiedSeats[seat] || showData.heldSeats[seat]
        );

        return !isAnySeatTaken;
    } catch (error) {
        console.log(error.message);
        return false;
    }
};

// Thay thế hàm createBooking trong bookingController.js
export const createBooking = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { showId, selectedSeats } = req.body;
        const { origin } = req.headers;

        const isAvailable = await checkSeatsAvailability(showId, selectedSeats);
        if (!isAvailable) {
            return res.json({ success: false, message: "Selected Seats are not available." });
        }

        // Lấy thông tin suất chiếu kèm theo Phòng và Phim
        const showData = await Show.findById(showId).populate('movie').populate('room');
        if (!showData || !showData.room) {
            return res.json({ success: false, message: "Lỗi dữ liệu suất chiếu hoặc phòng." });
        }

        // --- BACKEND TỰ TÍNH TIỀN ĐỂ CHỐNG HACK ---
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

        // Tạo hóa đơn mới
        const booking = await Booking.create({
            user: userId,
            show: showId,
            roomName: showData.room.name, // Lưu tên phòng vào hóa đơn
            amount: totalAmount, // Lưu tổng tiền đã tính
            bookedSeats: selectedSeats
        });

        // Cập nhật ghế đang đặt
        selectedSeats.forEach((seat) => {
            showData.heldSeats[seat] = userId; // Đưa vào hàng chờ
        });
        showData.markModified('heldSeats');
        await showData.save();

        // --- CẤU HÌNH STRIPE ---
        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY)
        const line_items = [{
            price_data: {
                currency: 'vnd', // LƯU Ý: Nếu dùng tiền Việt, bạn nên để là 'vnd', còn 'usd' thì chia tỷ giá
                product_data: { name: showData.movie.title },
                unit_amount: Math.floor(booking.amount) // Stripe VND không cần nhân 100
            },
            quantity: 1
        }]

        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/loading/my-bookings`,
            cancel_url: `${origin}/my-bookings`,
            line_items: line_items,
            mode: 'payment',
            metadata: { bookingId: booking._id.toString() },
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        })

        booking.paymentLink = session.url
        await booking.save()

        await inngest.send({
            name: "app/checkpayment",
            data: { bookingId: booking._id.toString() }
        });

        res.json({ success: true, url: session.url });

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};
export const getOccupiedSeats = async (req, res) => {
    try {
        const { showId } = req.params;
        const showData = await Show.findById(showId);
        const occupiedSeats = Object.keys(showData.occupiedSeats);
        res.json({ success: true, occupiedSeats });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

