import { inngest } from "../inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import stripe from 'stripe';

const HOLD_MINUTES = 10;
const MAX_SEATS_PER_BOOKING = 5;

const normalizeSelectedSeats = (selectedSeats) => {
    if (!Array.isArray(selectedSeats)) return [];
    return selectedSeats
        .filter(seat => typeof seat === 'string')
        .map(seat => seat.trim())
        .filter(Boolean);
};

const getBookableSeats = (seatMap) => {
    const seats = new Map();

    seatMap.forEach(row => {
        row.seats.forEach(seat => {
            if (seat.seatType !== 'EMPTY') {
                seats.set(seat.seatNumber, seat.seatType);
            }
        });
    });

    return seats;
};

const calculateTotalAmount = (selectedSeats, bookableSeats, basePrice) => {
    return selectedSeats.reduce((total, seatNum) => {
        const seatType = bookableSeats.get(seatNum);

        if (seatType === 'VIP') return total + basePrice + 20000;
        if (seatType === 'COUPLE') return total + basePrice * 2;
        return total + basePrice;
    }, 0);
};

const buildSeatAvailabilityQuery = (showId, selectedSeats) => {
    const query = { _id: showId };

    selectedSeats.forEach(seat => {
        query[`occupiedSeats.${seat}`] = { $exists: false };
        query[`heldSeats.${seat}`] = { $exists: false };
    });

    return query;
};

const releaseHeldSeats = async (showId, selectedSeats, userId) => {
    if (!selectedSeats.length) return;

    await Promise.all(selectedSeats.map(seat => (
        Show.updateOne(
            { _id: showId, [`heldSeats.${seat}`]: userId },
            { $unset: { [`heldSeats.${seat}`]: "" } }
        )
    )));
};

// Xử lý logic đặt vé và tạo phiên thanh toán Stripe
export const createBooking = async (req, res) => {
    let heldSeatsForRequest = [];
    let pendingBooking = null;
    let userIdForCleanup = null;
    let checkoutSessionIdForCleanup = null;

    try {
        const { userId } = req.auth();
        const { showId, selectedSeats } = req.body;
        const { origin } = req.headers;
        const normalizedSeats = normalizeSelectedSeats(selectedSeats);
        userIdForCleanup = userId;

        if (!userId) {
            return res.json({ success: false, message: "Vui lòng đăng nhập để đặt vé." });
        }

        if (!showId || normalizedSeats.length === 0) {
            return res.json({ success: false, message: "Vui lòng chọn suất chiếu và ghế ngồi hợp lệ." });
        }

        if (normalizedSeats.length > MAX_SEATS_PER_BOOKING) {
            return res.json({ success: false, message: `Bạn chỉ có thể đặt tối đa ${MAX_SEATS_PER_BOOKING} ghế trong một lần giao dịch.` });
        }

        const uniqueSeats = [...new Set(normalizedSeats)];
        if (uniqueSeats.length !== normalizedSeats.length) {
            return res.json({ success: false, message: "Danh sách ghế bị trùng. Vui lòng chọn lại." });
        }

        const showData = await Show.findById(showId).populate('movie').populate('room');
        if (!showData || !showData.room) {
            return res.json({ success: false, message: "Lỗi truy xuất dữ liệu suất chiếu hoặc phòng." });
        }

        if (showData.showDateTime <= new Date()) {
            return res.json({ success: false, message: "Suất chiếu đã bắt đầu hoặc đã kết thúc." });
        }

        const seatMap = showData.room.seatMap;
        const basePrice = showData.basePrice;
        const bookableSeats = getBookableSeats(seatMap);
        const invalidSeats = uniqueSeats.filter(seat => !bookableSeats.has(seat));

        if (invalidSeats.length > 0) {
            return res.json({ success: false, message: "Ghế bạn chọn không hợp lệ. Vui lòng chọn lại." });
        }

        const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
        const holdSeats = {};
        uniqueSeats.forEach(seat => {
            holdSeats[`heldSeats.${seat}`] = userId;
        });

        const heldShow = await Show.findOneAndUpdate(
            buildSeatAvailabilityQuery(showId, uniqueSeats),
            { $set: holdSeats },
            { new: true }
        );

        if (!heldShow) {
            return res.json({ success: false, message: "Ghế bạn chọn đã có người đặt hoặc đang được giữ." });
        }

        heldSeatsForRequest = uniqueSeats;

        const totalAmount = calculateTotalAmount(uniqueSeats, bookableSeats, basePrice);

        pendingBooking = await Booking.create({
            user: userId,
            show: showId,
            roomName: showData.room.name,
            amount: totalAmount,
            bookedSeats: uniqueSeats,
            status: 'pending',
            expiresAt: holdExpiresAt
        });

        // Khởi tạo phiên giao dịch Stripe
        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
        const line_items = [{
            price_data: {
                currency: 'vnd',
                product_data: { name: showData.movie.title },
                unit_amount: Math.floor(pendingBooking.amount)
            },
            quantity: 1
        }];

        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/loading/my-bookings`,
            cancel_url: `${origin}/my-bookings`,
            line_items: line_items,
            mode: 'payment',
            metadata: { bookingId: pendingBooking._id.toString() },
        });

        pendingBooking.paymentLink = session.url;
        pendingBooking.checkoutSessionId = session.id;
        checkoutSessionIdForCleanup = session.id;
        await pendingBooking.save();

        const io = req.app.get('io');
        if (io) {
            io.to(showId).emit('lock_seats_temporarily', uniqueSeats);
        }

        // Đẩy task vào hàng đợi Inngest để background job tự động kiểm tra trạng thái thanh toán
        await inngest.send({
            name: "app/checkpayment",
            data: {
                bookingId: pendingBooking._id.toString(),
                expiresAt: holdExpiresAt.toISOString()
            }
        });

        res.json({ success: true, url: session.url });

    } catch (error) {
        if (heldSeatsForRequest.length > 0 && req.body.showId && userIdForCleanup) {
            await releaseHeldSeats(req.body.showId, heldSeatsForRequest, userIdForCleanup);
        }

        if (checkoutSessionIdForCleanup) {
            try {
                const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
                await stripeInstance.checkout.sessions.expire(checkoutSessionIdForCleanup);
            } catch (stripeError) {
                console.log("Không thể expire Stripe Checkout session sau lỗi đặt vé:", stripeError.message);
            }
        }

        if (pendingBooking) {
            await Booking.findByIdAndDelete(pendingBooking._id);
        }

        console.log(error.message);
        res.json({ success: false, message: "Đã xảy ra lỗi trong quá trình đặt vé: " + error.message });
    }
};

// Lấy danh sách các ghế đã được đặt thành công
export const getOccupiedSeats = async (req, res) => {
    try {
        const { showId } = req.params;
        const showData = await Show.findById(showId);
        if (!showData) {
            return res.json({ success: false, message: "Suất chiếu không tồn tại." });
        }

        const occupiedSeats = Object.keys(showData.occupiedSeats);
        res.json({ success: true, occupiedSeats });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: "Lỗi khi lấy dữ liệu ghế ngồi: " + error.message });
    }
};