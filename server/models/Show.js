import mongoose from "mongoose";

export const SHOWTIME_STATUSES = ["SCHEDULED", "CANCELLED"];

const showSchema = new mongoose.Schema({
    // ID phim được chiếu.
    movie: { type: String, required: true, ref: 'Movie' }, 
    // ID phòng tổ chức suất chiếu.
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    // Thời điểm bắt đầu và kết thúc suất chiếu.
    showDateTime: { type: Date, required: true },
    endDateTime: { type: Date },
    // Thời lượng phim tính bằng phút tại lúc tạo suất chiếu.
    runtimeMinutes: { type: Number, min: 1 },
    // Số phút cần để dọn phòng sau phim.
    cleanupMinutes: { type: Number, min: 0, default: 15 },
    // Giá cơ sở dùng để tính giá từng loại ghế.
    basePrice: { type: Number, required: true }, 
    // Trạng thái suất chiếu: đã lên lịch hoặc đã hủy.
    status: { type: String, enum: SHOWTIME_STATUSES, default: "SCHEDULED" },
    // Lý do và thời điểm hủy suất chiếu.
    cancellationReason: { type: String, trim: true, default: "" },
    cancelledAt: { type: Date, default: null },
    // Bản đồ ghế đã thanh toán; key là mã ghế, value thường là ID người đặt.
    occupiedSeats: { type: Object, default: {} } ,
    // Bản đồ ghế đang được giữ tạm trong lúc chờ thanh toán.
    heldSeats: { type: Object, default: {} }
// minimize: false giữ lại object rỗng; timestamps tự thêm createdAt và updatedAt.
}, { minimize: false, timestamps: true });

const Show = mongoose.model("Show", showSchema);
export default Show;
