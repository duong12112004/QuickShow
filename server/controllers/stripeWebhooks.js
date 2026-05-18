import Stripe from "stripe";
import Booking from "../models/Booking.js";
import { inngest } from "../inngest/index.js";
import {
    BOOKING_STATUS,
    PAYMENT_STATUS,
    STATUS_ACTOR,
    confirmBookingPaid
} from "../services/bookingService.js";

const getStripeInstance = () => new Stripe(process.env.STRIPE_SECRET_KEY);

const emitBookedSeats = (req, booking) => {
    const io = req.app.get("io");

    if (io) {
        io.to(booking.show.toString()).emit("seats_booked_successfully", booking.bookedSeats);
        console.log(`[Socket] Đã phát tín hiệu chốt vé cho suất: ${booking.show}`);
    }
};

const handleSuccessfulCheckoutSession = async (req, session) => {
    const bookingId = session?.metadata?.bookingId;

    if (!bookingId) {
        return;
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
        return;
    }

    if ([PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED].includes(booking.paymentStatus)) {
        return;
    }

    if ([BOOKING_STATUS.CANCELLED, BOOKING_STATUS.PAYMENT_EXPIRED, BOOKING_STATUS.REFUNDED].includes(booking.bookingStatus)) {
        return;
    }

    await confirmBookingPaid(booking, {
        actor: STATUS_ACTOR.STRIPE,
        note: "Stripe xác nhận thanh toán thành công.",
        sessionId: session.id || booking.stripeSessionId,
        paymentIntentId: `${session.payment_intent || booking.paymentIntentId || ""}`
    });
    emitBookedSeats(req, booking);

    await inngest.send({
        name: "app/show.booked",
        data: { bookingId }
    });
};

export const stripeWebhooks = async (req, res) => {
    const stripeInstance = getStripeInstance();
    const sig = req.headers["stripe-signature"];

    let event;

    try {
        event = stripeInstance.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
        console.error("Lỗi xác thực webhook:", error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                await handleSuccessfulCheckoutSession(req, session);
                break;
            }

            case "payment_intent.succeeded": {
                const paymentIntent = event.data.object;
                const sessionList = await stripeInstance.checkout.sessions.list({
                    payment_intent: paymentIntent.id
                });

                const session = sessionList.data[0];
                if (session) {
                    await handleSuccessfulCheckoutSession(req, session);
                }
                break;
            }

            default:
                console.log("Sự kiện Stripe chưa được xử lý:", event.type);
        }

        res.json({ received: true });
    } catch (error) {
        console.error("Lỗi khi xử lý webhook:", error);
        res.status(500).send("Internal Server Error");
    }
};
