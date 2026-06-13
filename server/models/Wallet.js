import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({
    // Chủ ví; unique đảm bảo mỗi người dùng chỉ có một ví.
    user: { type: String, required: true, unique: true, ref: "User" },
    // Số dư hiện tại, không được âm.
    balance: { type: Number, default: 0, min: 0 },
    // Đơn vị tiền tệ của ví.
    currency: { type: String, default: "VND" }
// timestamps tự thêm createdAt và updatedAt.
}, { timestamps: true });

const Wallet = mongoose.model("Wallet", walletSchema);
export default Wallet;
