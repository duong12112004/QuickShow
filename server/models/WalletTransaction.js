import mongoose from "mongoose";

export const WALLET_TRANSACTION_TYPES = ["CREDIT", "DEBIT", "REVERSAL"];
export const WALLET_TRANSACTION_STATUSES = ["COMPLETED", "FAILED"];

const walletTransactionSchema = new mongoose.Schema({
    // Người dùng sở hữu giao dịch ví.
    user: { type: String, required: true, ref: "User", index: true },
    // Booking liên quan; có thể null nếu giao dịch không phát sinh từ booking.
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
    // Loại giao dịch: CREDIT cộng tiền, DEBIT trừ tiền, REVERSAL hoàn tác giao dịch trước.
    type: { type: String, enum: WALLET_TRANSACTION_TYPES, required: true },
    // Số tiền thay đổi trong giao dịch.
    amount: { type: Number, required: true, min: 0 },
    // Số dư ví ngay sau khi giao dịch hoàn tất.
    balanceAfter: { type: Number, required: true, min: 0 },
    // Đơn vị tiền tệ.
    currency: { type: String, default: "VND" },
    // Nội dung giải thích giao dịch.
    note: { type: String, default: "" },
    // Trạng thái giao dịch: thành công hoặc thất bại.
    status: { type: String, enum: WALLET_TRANSACTION_STATUSES, default: "COMPLETED" },
    // Dữ liệu phụ linh hoạt, ví dụ bookingCode hoặc showId.
    metadata: { type: Object, default: {} }
// minimize: false giữ object metadata rỗng; timestamps tự thêm createdAt và updatedAt.
}, { minimize: false, timestamps: true });

// Tối ưu truy vấn lịch sử ví của một người dùng theo thời gian mới nhất.
walletTransactionSchema.index({ user: 1, createdAt: -1 });

const WalletTransaction = mongoose.model("WalletTransaction", walletTransactionSchema);
export default WalletTransaction;
