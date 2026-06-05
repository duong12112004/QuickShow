import mongoose from "mongoose";

export const WALLET_TRANSACTION_TYPES = ["CREDIT", "DEBIT", "REVERSAL"];
export const WALLET_TRANSACTION_STATUSES = ["COMPLETED", "FAILED"];

const walletTransactionSchema = new mongoose.Schema({
    user: { type: String, required: true, ref: "User", index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
    type: { type: String, enum: WALLET_TRANSACTION_TYPES, required: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "VND" },
    note: { type: String, default: "" },
    status: { type: String, enum: WALLET_TRANSACTION_STATUSES, default: "COMPLETED" },
    metadata: { type: Object, default: {} }
}, { minimize: false, timestamps: true });

walletTransactionSchema.index({ user: 1, createdAt: -1 });

const WalletTransaction = mongoose.model("WalletTransaction", walletTransactionSchema);
export default WalletTransaction;
