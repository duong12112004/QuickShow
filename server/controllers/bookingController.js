import { inngest } from "../inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import stripe from "stripe";
import { getShowtimeLifecycle, SHOWTIME_STATUS } from "../services/showtimeService.js";

const getBookableShowtime = async (showId) => {
    const showData = await Show.findById(showId).populate("movie").populate("room");

    if (!showData || !showData.room) {
        throw new Error("Lỗi truy xuất dữ liệu suất chiếu hoặc phòng.");
    }

    if ((showData.status || SHOWTIME_STATUS.SCHEDULED) !== SHOWTIME_STATUS.SCHEDULED) {
        throw new Error("Suất chiếu này không còn mở bán.");
    }

    if (showData.room.status && showData.room.status !== "ACTIVE") {
        throw new Error("Phòng chiếu hiện không khả dụng.");
    }

    if (getShowtimeLifecycle(showData) !== "UPCOMING") {
        throw new Error("Đã qua thời gian đặt vé cho suất chiếu này.");
    }

    return showData;
};

const checkSeatsAvailability = async (showId, selectedSeats) => {
    try {
        const showData = await getBookableShowtime(showId);

        const isAnySeatTaken = selectedSeats.some((seat) =>
            showData.occupiedSeats[seat] || showData.heldSeats[seat]
        );

        return !isAnySeatTaken;
    } catch (error) {
        return false;
    }
};

export const createBooking = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { showId, selectedSeats } = req.body;
        const { origin } = req.headers;

        const isAvailable = await checkSeatsAvailability(showId, selectedSeats);
        if (!isAvailable) {
            return res.json({ success: false, message: "Ghế bạn chọn đã có người đặt, đang được giữ, hoặc suất chiếu không còn khả dụng." });
        }

        const showData = await getBookableShowtime(showId);

        const seatMap = showData.room.seatMap;
        const basePrice = showData.basePrice;
        let totalAmount = 0;

        selectedSeats.forEach((seatNum) => {
            let seatType = "STANDARD";
            seatMap.forEach((row) => {
                row.seats.forEach((seat) => {
                    if (seat.seatNumber === seatNum) seatType = seat.seatType;
                });
            });

            if (seatType === "VIP") totalAmount += (basePrice + 20000);
            else if (seatType === "COUPLE") totalAmount += (basePrice * 2);
            else totalAmount += basePrice;
        });

        const booking = await Booking.create({
            user: userId,
            show: showId,
            roomName: showData.room.name,
            amount: totalAmount,
            bookedSeats: selectedSeats
        });

        selectedSeats.forEach((seat) => {
            showData.heldSeats[seat] = userId;
        });
        showData.markModified("heldSeats");
        await showData.save();

        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
        const line_items = [{
            price_data: {
                currency: "vnd",
                product_data: { name: showData.movie.title },
                unit_amount: Math.floor(booking.amount)
            },
            quantity: 1
        }];

        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/loading/my-bookings`,
            cancel_url: `${origin}/my-bookings`,
            line_items,
            mode: "payment",
            metadata: { bookingId: booking._id.toString() },
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60
        });

        booking.paymentLink = session.url;
        await booking.save();

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

export const getOccupiedSeats = async (req, res) => {
    try {
        const { showId } = req.params;
        const showData = await Show.findById(showId);

        if (!showData) {
            return res.json({ success: false, message: "Suất chiếu không tồn tại." });
        }

        if ((showData.status || SHOWTIME_STATUS.SCHEDULED) !== SHOWTIME_STATUS.SCHEDULED) {
            return res.json({ success: false, message: "Suất chiếu này không còn mở bán." });
        }

        const occupiedSeats = Object.keys(showData.occupiedSeats || {});
        res.json({ success: true, occupiedSeats });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: "Lỗi khi lấy dữ liệu ghế ngồi: " + error.message });
    }
};
