import stripe from "stripe";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import { inngest } from "../inngest/index.js";

export const stripeWebhooks = async (request, response) => {
    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
    const sig = request.headers["stripe-signature"];

    let event;

    try {
        event = stripeInstance.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
        return response.status(400).send(`Webhook Error: ${error.message}`);
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

                // 1. Lấy thông tin Booking và cập nhật trạng thái đã thanh toán
                const booking = await Booking.findByIdAndUpdate(bookingId, {
                    isPaid: true,
                    paymentLink: ""
                }, { new: true }); // Thêm { new: true } để trả về data mới nhất

                // 2. LOGIC BẮT BUỘC ĐỂ SỬA LỖI NHÁY CAM: Chuyển ghế từ Held sang Occupied
                if (booking) {
                    const show = await Show.findById(booking.show);
                    if (show) {
                        booking.bookedSeats.forEach((seat) => {
                            delete show.heldSeats[seat]; // Nhả ghế đang giữ
                            show.occupiedSeats[seat] = booking.user; // Chốt ghế đã mua
                        });
                        show.markModified('heldSeats');
                        show.markModified('occupiedSeats');
                        await show.save();
                    }
                }

                // 3. Gửi Confirmation Email
                await inngest.send({
                    name: "app/show.booked",
                    data: { bookingId }
                });

                break;
            }

            default:
                console.log('Unhandled event type:', event.type);
        }

        response.json({ received: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        response.status(500).send("Internal Server Error");
    }
};