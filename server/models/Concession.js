import mongoose from "mongoose";

export const CONCESSION_STATUS = {
    // Đang bán.
    ACTIVE: "ACTIVE",
    // Tạm ngừng bán.
    INACTIVE: "INACTIVE"
};

export const CONCESSION_CATEGORY = {
    // Gói gồm nhiều món.
    COMBO: "COMBO",
    // Bắp rang.
    POPCORN: "POPCORN",
    // Nước uống.
    DRINK: "DRINK",
    // Đồ ăn nhẹ khác.
    SNACK: "SNACK"
};

const concessionSchema = new mongoose.Schema({
    // Tên món/combo hiển thị cho khách.
    name: { type: String, required: true, trim: true },
    // Mô tả chi tiết món.
    description: { type: String, default: "", trim: true },
    // URL ảnh đại diện của món.
    imageUrl: { type: String, default: "", trim: true },
    // Giá bán, không được âm.
    price: { type: Number, required: true, min: 0 },
    // Nhóm món dùng để phân loại.
    category: {
        type: String,
        enum: Object.values(CONCESSION_CATEGORY),
        default: CONCESSION_CATEGORY.COMBO
    },
    // Trạng thái quyết định món có đang được bán hay không.
    status: {
        type: String,
        enum: Object.values(CONCESSION_STATUS),
        default: CONCESSION_STATUS.ACTIVE
    },
    // Số dùng để điều khiển thứ tự hiển thị; số nhỏ thường đứng trước.
    sortOrder: { type: Number, default: 0 }
// timestamps tự thêm createdAt và updatedAt.
}, { timestamps: true });

const Concession = mongoose.model("Concession", concessionSchema);
export default Concession;
