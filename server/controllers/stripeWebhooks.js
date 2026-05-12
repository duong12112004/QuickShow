import stripe from "stripe";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import { inngest } from "../inngest/index.js";

export const stripeWebhooks = async (req, res) => {
    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers["stripe-signature"];

    let event;

    try {
        event = stripeInstance.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
        console.error("Lỗi xác thực Webhook:", error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                const { bookingId } = session.metadata || {};

                if (!bookingId) {
                    console.error("Checkout session không có bookingId trong metadata.");
                    break;
                }

                if (session.payment_status !== 'paid') {
                    console.log(`Checkout session ${session.id} chưa được thanh toán.`);
                    break;
                }

                const booking = await Booking.findById(bookingId);
                if (!booking) {
                    console.error(`Không tìm thấy booking ${bookingId} từ Stripe webhook.`);
                    break;
                }

                if (booking.status === 'paid' || booking.isPaid) {
                    break;
                }

                const show = await Show.findById(booking.show);
                if (!show) {
                    throw new Error(`Không tìm thấy suất chiếu của booking ${bookingId}.`);
                }

                const alreadyBooked = booking.bookedSeats.every(seat => show.occupiedSeats?.[seat] === booking.user);

                if (!alreadyBooked) {
                    const showQuery = { _id: booking.show };
                    const unsetHeldSeats = {};
                    const setOccupiedSeats = {};

                    booking.bookedSeats.forEach((seat) => {
                        showQuery[`heldSeats.${seat}`] = booking.user;
                        showQuery[`occupiedSeats.${seat}`] = { $exists: false };
                        unsetHeldSeats[`heldSeats.${seat}`] = "";
                        setOccupiedSeats[`occupiedSeats.${seat}`] = booking.user;
                    });

                    const updatedShow = await Show.findOneAndUpdate(showQuery, {
                        $unset: unsetHeldSeats,
                        $set: setOccupiedSeats
                    }, { new: true });

                    if (!updatedShow) {
                        throw new Error(`Không thể chốt ghế cho booking ${bookingId}; ghế có thể đã hết hạn giữ hoặc bị chiếm.`);
                    }
                }

                booking.isPaid = true;
                booking.status = 'paid';
                booking.paymentLink = "";
                await booking.save();

                // Phát tín hiệu Socket.io để cập nhật giao diện real-time cho các user khác
                const io = req.app.get('io');
                if (io) {
                    io.to(booking.show.toString()).emit('seats_booked_successfully', booking.bookedSeats);
                    console.log(`[Socket] Đã phát tín hiệu chốt vé cho suất: ${booking.show}`);
                }

                // Đẩy task gửi email xác nhận vào Inngest
                await inngest.send({
                    name: "app/show.booked",
                    data: { bookingId }
                });

                break;
            }

            default:
                console.log('Sự kiện Stripe chưa được xử lý:', event.type);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Lỗi khi xử lý Webhook:', error);
        res.status(500).send("Internal Server Error");
    }
};