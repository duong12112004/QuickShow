import mongoose from "mongoose";
import {
    applyRoomDerivedFields,
    ROOM_STATUSES,
    ROOM_TYPES,
    SEAT_TYPES
} from "../services/roomService.js";

const roomSchema = new mongoose.Schema({
    // Tên phòng chiếu, bắt buộc không được trùng.
    name: { type: String, required: true, trim: true, unique: true },
    // Loại phòng, ví dụ 2D.
    roomType: { type: String, enum: ROOM_TYPES, default: '2D' },
    // Trạng thái hoạt động của phòng.
    status: { type: String, enum: ROOM_STATUSES, default: 'ACTIVE' },
    // Ghi chú lý do hoặc công việc bảo trì.
    maintenanceNote: { type: String, trim: true, default: '' },
    // Tổng số ghế có thể bán trong phòng.
    capacity: { type: Number, min: 0, default: 0 },
    // Các số liệu tổng hợp được tính tự động từ seatMap.
    seatStats: {
        // Số ghế tiêu chuẩn.
        standard: { type: Number, min: 0, default: 0 },
        // Số ghế VIP.
        vip: { type: Number, min: 0, default: 0 },
        // Số ghế đôi.
        couple: { type: Number, min: 0, default: 0 },
        // Số vị trí trống/lối đi trong sơ đồ.
        empty: { type: Number, min: 0, default: 0 },
        // Tổng số hàng ghế.
        totalRows: { type: Number, min: 0, default: 0 }
    },
    // Sơ đồ ghế của phòng, được chia theo từng hàng.
    seatMap: [{
        // Tên hàng ghế, ví dụ A, B, C.
        row: { type: String, required: true },
        seats: [{
            // Mã ghế đầy đủ, ví dụ A1.
            seatNumber: { type: String, required: true },
            // Loại ghế hoặc vị trí trống.
            seatType: { type: String, enum: SEAT_TYPES, default: 'STANDARD' }
        }]
    }]
// timestamps tự thêm createdAt và updatedAt.
}, { timestamps: true });

roomSchema.pre('validate', function () {
    applyRoomDerivedFields(this);
});

const Room = mongoose.model("Room", roomSchema);
export default Room;
