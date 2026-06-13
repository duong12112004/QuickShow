import express from "express";
import {
    createMovieComment,
    getMovieReviews,
    getReviewSummaries,
    rateBooking,
    submitBookingReview
} from "../controllers/reviewController.js";

const reviewRouter = express.Router();

// Lấy điểm tổng hợp của nhiều phim và danh sách bình luận công khai của một phim.
reviewRouter.get("/summaries", getReviewSummaries);
reviewRouter.get("/movie/:movieId", getMovieReviews);

// Tạo bình luận tự do, không yêu cầu booking đã mua vé.
reviewRouter.post("/", createMovieComment);
// Đánh giá đầy đủ hoặc chỉ chấm điểm bằng một booking hợp lệ.
reviewRouter.post("/booking", submitBookingReview);
reviewRouter.post("/rating", rateBooking);

export default reviewRouter;
