import mongoose from "mongoose";
import {
    BOOKING_STATUS,
    PAYMENT_PROVIDER,
    PAYMENT_STATUS,
    createBookingCode
} from "../services/bookingService.js";

const bookingSchema = new mongoose.Schema({
    // ID người đặt vé, liên kết đến User. Dùng String vì ID người dùng đến từ Clerk.
    user: { type: String, required: true, ref: 'User' },
    // ID suất chiếu được đặt.
    show: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Show' },
    // Mã booking duy nhất để tra cứu và check-in; sparse cho phép dữ liệu cũ chưa có mã.
    bookingCode: { type: String, unique: true, sparse: true, default: createBookingCode },

    // Snapshot thông tin suất chiếu tại lúc đặt, tránh bị thay đổi khi dữ liệu phim/phòng được cập nhật.
    roomName: { type: String, required: true },
    movieTitle: { type: String, default: "" },
    showDateTime: { type: Date, default: null },

    // Danh sách mã ghế đã đặt, ví dụ ["A1", "A2"].
    bookedSeats: [{ type: String, required: true }],
    // Chi tiết loại và giá của từng ghế tại thời điểm đặt.
    seatDetails: [{
        // Mã ghế, ví dụ A1.
        seatNumber: { type: String, required: true },
        // Loại ghế: STANDARD, VIP hoặc COUPLE.
        seatType: { type: String, required: true },
        // Giá của riêng ghế này.
        unitPrice: { type: Number, required: true }
    }],
    // Tổng tiền vé, chưa gồm bắp nước.
    ticketAmount: { type: Number, default: 0 },

    // Snapshot các món bắp nước mua kèm booking.
    concessionItems: [{
        // ID món gốc; có thể null nếu món đã bị xóa hoặc dữ liệu cũ không có liên kết.
        concession: { type: mongoose.Schema.Types.ObjectId, ref: "Concession", default: null },
        name: { type: String, required: true },
        category: { type: String, default: "" },
        // Giá một đơn vị tại thời điểm đặt.
        unitPrice: { type: Number, required: true },
        // Số lượng mua, tối thiểu là 1.
        quantity: { type: Number, required: true, min: 1 },
        // Thành tiền của món: unitPrice * quantity.
        totalPrice: { type: Number, required: true }
    }],
    // Tổng tiền của toàn bộ bắp nước.
    concessionAmount: { type: Number, default: 0 },
    // Tổng giá trị booking: ticketAmount + concessionAmount.
    amount: { type: Number, required: true },
    // Đơn vị tiền tệ dùng trong booking.
    currency: { type: String, default: "VND" },

    // Trạng thái nghiệp vụ của booking: chờ thanh toán, đã xác nhận, đã check-in, đã hủy...
    bookingStatus: {
        type: String,
        enum: Object.values(BOOKING_STATUS),
        default: BOOKING_STATUS.PENDING_PAYMENT
    },
    // Trạng thái riêng của khoản thanh toán: chưa trả, đã trả, hết hạn, hoàn tiền...
    paymentStatus: {
        type: String,
        enum: Object.values(PAYMENT_STATUS),
        default: PAYMENT_STATUS.UNPAID
    },
    // Cờ tương thích để kiểm tra nhanh booking đã được thanh toán hay chưa.
    isPaid: { type: Boolean, default: false },
    // Cổng thanh toán được chọn cho phần tiền không trả bằng ví QuickShow.
    paymentProvider: {
        type: String,
        enum: Object.values(PAYMENT_PROVIDER),
        default: PAYMENT_PROVIDER.STRIPE_TEST
    },
    // Số tiền đã trừ từ ví QuickShow.
    walletAmountUsed: { type: Number, default: 0 },
    // Phần tiền còn lại trả qua cổng thanh toán; tên cũ là stripeAmount nhưng cũng dùng cho ZaloPay.
    stripeAmount: { type: Number, default: 0 },
    // URL chuyển người dùng đến trang thanh toán.
    paymentLink: { type: String },
    // Thời điểm booking chờ thanh toán hết hạn và ghế được nhả.
    expiresAt: { type: Date, default: null },

    // Thông tin hủy booking.
    cancelledBy: { type: String, default: "" },
    cancelReason: { type: String, default: "" },
    cancelledAt: { type: Date, default: null },

    // Thông tin check-in tại rạp.
    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: String, default: "" },

    // Thông tin hoàn tiền.
    refundedAt: { type: Date, default: null },
    // Số tiền thực tế hoàn cho khách.
    refundAmount: { type: Number, default: 0 },
    // Phần phí bị giữ lại khi hoàn tiền.
    refundFeeAmount: { type: Number, default: 0 },
    // Tỷ lệ hoàn tiền, ví dụ 0.8 tương ứng 80%.
    refundRate: { type: Number, default: 0 },
    // Nơi nhận tiền hoàn: Stripe, ví QuickShow hoặc kết hợp cả hai.
    refundMethod: { type: String, enum: ["STRIPE", "WALLET", "MIXED", ""], default: "" },
    refundReason: { type: String, default: "" },

    // Các mã tham chiếu dùng để đối soát giao dịch Stripe.
    stripeSessionId: { type: String, default: "" },
    paymentIntentId: { type: String, default: "" },
    stripeRefundId: { type: String, default: "" },

    // Các mã/token và dữ liệu phản hồi dùng để đối soát giao dịch ZaloPay.
    zalopayAppTransId: { type: String, default: "" },
    zalopayZpTransToken: { type: String, default: "" },
    zalopayOrderToken: { type: String, default: "" },
    zalopayZpTransId: { type: String, default: "" },
    zalopayQrCode: { type: String, default: "" },
    zalopayReturnCode: { type: Number, default: null },
    zalopayReturnMessage: { type: String, default: "" },
    zalopayRawResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    zalopayCallbackData: { type: mongoose.Schema.Types.Mixed, default: null },

    // Thời điểm email xác nhận booking đã được gửi.
    confirmationEmailSentAt: { type: Date, default: null },
    // Thời điểm gần nhất booking hoặc thanh toán đổi trạng thái.
    lastStatusChangedAt: { type: Date, default: Date.now },
    // Nhật ký toàn bộ lần thay đổi trạng thái để tra cứu và xử lý sự cố.
    statusHistory: [{
        // Trạng thái booking tại thời điểm ghi lịch sử.
        status: { type: String, required: true },
        // Trạng thái thanh toán tại thời điểm ghi lịch sử.
        paymentStatus: { type: String, required: true },
        // Tác nhân gây thay đổi: USER, ADMIN, SYSTEM, STRIPE hoặc ZALOPAY.
        actor: { type: String, required: true },
        // Nội dung giải thích cho lần thay đổi.
        note: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now }
    }]
// timestamps tự thêm createdAt và updatedAt cho booking.
}, { timestamps: true });

bookingSchema.pre("save", function setBookingDefaults() {
    if (!this.bookingCode) {
        this.bookingCode = createBookingCode();
    }
});

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
