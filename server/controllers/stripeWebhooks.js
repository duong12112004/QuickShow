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
            case "payment_intent.succeeded": {
                const paymentIntent = event.data.object;
                const sessionList = await stripeInstance.checkout.sessions.list({
                    payment_intent: paymentIntent.id
                });

                const session = sessionList.data[0];
                const { bookingId } = session.metadata;

                // 1. Cập nhật trạng thái thanh toán của hóa đơn
                const booking = await Booking.findByIdAndUpdate(bookingId, {
                    isPaid: true,
                    paymentLink: ""
                }, { new: true });

                // 2. Chuyển trạng thái ghế từ đang giữ (heldSeats) sang đã mua (occupiedSeats)
                if (booking) {
                    const show = await Show.findById(booking.show);
                    if (show) {
                        booking.bookedSeats.forEach((seat) => {
                            delete show.heldSeats[seat]; 
                            show.occupiedSeats[seat] = booking.user; 
                        });
                        show.markModified('heldSeats');
                        show.markModified('occupiedSeats');
                        await show.save();

                        // Phát tín hiệu Socket.io để cập nhật giao diện real-time cho các user khác
                        const io = req.app.get('io');
                        if (io) {
                            io.to(booking.show.toString()).emit('seats_booked_successfully', booking.bookedSeats);
                            console.log(`[Socket] Đã phát tín hiệu chốt vé cho suất: ${booking.show}`);
                        }
                    }
                }

                // 3. Đẩy task gửi email xác nhận vào Inngest
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