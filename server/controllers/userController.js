import { clerkClient } from "@clerk/express";
import Booking from "../models/Booking.js";
import Movie from "../models/Movie.js";

// Lấy danh sách lịch sử đặt vé của người dùng
export const getUserBookings = async (req, res) => {
    try {
        const { userId } = req.auth();

        const bookings = await Booking.find({ user: userId })
            .populate({
                path: "show",
                populate: { path: "movie" }
            })
            .sort({ createdAt: -1 });
            
        res.json({ success: true, bookings });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi tải lịch sử đặt vé: " + error.message });
    }
};

// Thêm hoặc xóa phim khỏi danh sách yêu thích (Lưu trữ trên Clerk Metadata)
export const updateFavorite = async (req, res) => {
    try {
        const { movieId } = req.body;
        const { userId } = req.auth();

        const user = await clerkClient.users.getUser(userId);

        if (!user.privateMetadata.favorites) {
            user.privateMetadata.favorites = [];
        }

        // Logic Toggle: Nếu đã có thì xóa, chưa có thì thêm vào danh sách
        if (!user.privateMetadata.favorites.includes(movieId)) {
            user.privateMetadata.favorites.push(movieId);
        } else {
            user.privateMetadata.favorites = user.privateMetadata.favorites.filter(item => item !== movieId);
        }

        await clerkClient.users.updateUserMetadata(userId, { privateMetadata: user.privateMetadata });

        res.json({ success: true, message: "Đã cập nhật danh sách phim yêu thích!" });

    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi cập nhật phim yêu thích: " + error.message });
    }
};

// Lấy thông tin chi tiết các bộ phim yêu thích của người dùng
export const getFavorites = async (req, res) => {
    try {
        const { userId } = req.auth();
        const user = await clerkClient.users.getUser(userId);
        const favorites = user.privateMetadata.favorites || []; 

        // Truy vấn database để lấy đầy đủ dữ liệu phim từ mảng ID yêu thích
        const movies = await Movie.find({ _id: { $in: favorites } });

        res.json({ success: true, movies });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi tải danh sách phim yêu thích: " + error.message });
    }
};