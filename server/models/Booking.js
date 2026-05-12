import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
    user: { type: String, required: true, ref: 'User' },
    show: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Show' },
    roomName: { type: String, required: true }, 
    bookedSeats: { type: Array, required: true },
    amount: { type: Number, required: true },
    isPaid: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ['pending', 'paid', 'expired', 'cancelled', 'refunded'],
        default: 'pending'
    },
    paymentLink: { type: String },
    checkoutSessionId: { type: String },
    expiresAt: { type: Date },
}, { timestamps: true });

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;