import mongoose from "mongoose";
import {
    BOOKING_STATUS,
    PAYMENT_PROVIDER,
    PAYMENT_STATUS,
    createBookingCode
} from "../services/bookingService.js";

const bookingSchema = new mongoose.Schema({
    user: { type: String, required: true, ref: 'User' },
    show: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Show' },
    bookingCode: { type: String, unique: true, sparse: true, default: createBookingCode },
    roomName: { type: String, required: true },
    movieTitle: { type: String, default: "" },
    showDateTime: { type: Date, default: null },
    bookedSeats: [{ type: String, required: true }],
    seatDetails: [{
        seatNumber: { type: String, required: true },
        seatType: { type: String, required: true },
        unitPrice: { type: Number, required: true }
    }],
    ticketAmount: { type: Number, default: 0 },
    concessionItems: [{
        concession: { type: mongoose.Schema.Types.ObjectId, ref: "Concession", default: null },
        name: { type: String, required: true },
        category: { type: String, default: "" },
        unitPrice: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
        totalPrice: { type: Number, required: true }
    }],
    concessionAmount: { type: Number, default: 0 },
    amount: { type: Number, required: true },
    currency: { type: String, default: "VND" },
    bookingStatus: {
        type: String,
        enum: Object.values(BOOKING_STATUS),
        default: BOOKING_STATUS.PENDING_PAYMENT
    },
    paymentStatus: {
        type: String,
        enum: Object.values(PAYMENT_STATUS),
        default: PAYMENT_STATUS.UNPAID
    },
    isPaid: { type: Boolean, default: false },
    paymentProvider: {
        type: String,
        enum: Object.values(PAYMENT_PROVIDER),
        default: PAYMENT_PROVIDER.STRIPE_TEST
    },
    walletAmountUsed: { type: Number, default: 0 },
    stripeAmount: { type: Number, default: 0 },
    paymentLink: { type: String },
    expiresAt: { type: Date, default: null },
    cancelledBy: { type: String, default: "" },
    cancelReason: { type: String, default: "" },
    cancelledAt: { type: Date, default: null },
    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: String, default: "" },
    refundedAt: { type: Date, default: null },
    refundAmount: { type: Number, default: 0 },
    refundFeeAmount: { type: Number, default: 0 },
    refundRate: { type: Number, default: 0 },
    refundMethod: { type: String, enum: ["STRIPE", "WALLET", "MIXED", ""], default: "" },
    refundReason: { type: String, default: "" },
    stripeSessionId: { type: String, default: "" },
    paymentIntentId: { type: String, default: "" },
    stripeRefundId: { type: String, default: "" },
    zalopayAppTransId: { type: String, default: "" },
    zalopayZpTransToken: { type: String, default: "" },
    zalopayOrderToken: { type: String, default: "" },
    zalopayZpTransId: { type: String, default: "" },
    zalopayQrCode: { type: String, default: "" },
    zalopayReturnCode: { type: Number, default: null },
    zalopayReturnMessage: { type: String, default: "" },
    zalopayRawResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    zalopayCallbackData: { type: mongoose.Schema.Types.Mixed, default: null },
    confirmationEmailSentAt: { type: Date, default: null },
    lastStatusChangedAt: { type: Date, default: Date.now },
    statusHistory: [{
        status: { type: String, required: true },
        paymentStatus: { type: String, required: true },
        actor: { type: String, required: true },
        note: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

bookingSchema.pre("save", function setBookingDefaults() {
    if (!this.bookingCode) {
        this.bookingCode = createBookingCode();
    }
});

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
