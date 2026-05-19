import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({
    user: { type: String, required: true, unique: true, ref: "User" },
    balance: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "VND" }
}, { timestamps: true });

const Wallet = mongoose.model("Wallet", walletSchema);
export default Wallet;
