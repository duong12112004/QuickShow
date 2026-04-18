import { clerkClient } from "@clerk/express";

// Middleware kiểm tra quyền Admin để bảo vệ các API quản trị
export const protectAdmin = async (req, res, next) => {
    try {
        const { userId } = req.auth(); 

        // Truy xuất thông tin người dùng từ hệ thống Clerk
        const user = await clerkClient.users.getUser(userId);

        // Kiểm tra phân quyền trong metadata
        if (user.privateMetadata.role !== 'admin') {
            return res.json({ success: false, message: "Bạn không có quyền truy cập chức năng này!" });
        }

        // Nếu là Admin, cho phép request đi tiếp đến Controller
        next();
    } catch (error) {
        console.error("Lỗi Middleware protectAdmin:", error.message);
        return res.json({ success: false, message: "Lỗi xác thực quyền truy cập: " + error.message });
    }
};