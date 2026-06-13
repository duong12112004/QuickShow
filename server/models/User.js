import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    // ID người dùng từ hệ thống xác thực Clerk.
    _id: { type: String, required: true },
    // Tên hiển thị của người dùng.
    name: { type: String, required: true },
    // Email của người dùng.
    email: { type: String, required: true },
    // URL ảnh đại diện.
    image: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

export default User;
