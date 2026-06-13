import mongoose from "mongoose";

export const REVIEW_STATUS = {
    // Đánh giá được hiển thị công khai.
    VISIBLE: "VISIBLE",
    // Đánh giá bị admin ẩn.
    HIDDEN: "HIDDEN"
};

const movieReviewSchema = new mongoose.Schema({
    // ID phim được đánh giá; index giúp tìm review theo phim nhanh hơn.
    movie: { type: String, required: true, ref: "Movie", index: true },
    // ID người viết đánh giá.
    user: { type: String, required: true, index: true },
    // Snapshot tên và ảnh người dùng để hiển thị cùng review.
    userName: { type: String, default: "" },
    userImage: { type: String, default: "" },
    // Nội dung nhận xét.
    comment: { type: String, trim: true, default: "" },
    // Đánh dấu nội dung có tiết lộ tình tiết phim.
    hasSpoiler: { type: Boolean, default: false },
    // Điểm người dùng chấm trên thang 1 đến 10.
    rating: { type: Number, min: 1, max: 10, default: null },
    // Booking chứng minh người dùng đã mua vé; unique ngăn một booking đánh giá nhiều lần.
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        unique: true,
        sparse: true
    },
    // Suất chiếu liên quan đến booking đã dùng để đánh giá.
    show: { type: mongoose.Schema.Types.ObjectId, ref: "Show", default: null },
    // Cho biết review đến từ người thực sự đã mua vé.
    isVerifiedViewer: { type: Boolean, default: false },
    // Trạng thái hiển thị của review.
    status: {
        type: String,
        enum: Object.values(REVIEW_STATUS),
        default: REVIEW_STATUS.VISIBLE,
        index: true
    },
    // Thông tin admin ẩn review.
    hiddenAt: { type: Date, default: null },
    hiddenBy: { type: String, default: "" },
    hiddenReason: { type: String, trim: true, default: "" }
// timestamps tự thêm createdAt và updatedAt.
}, { timestamps: true });

movieReviewSchema.index({ movie: 1, status: 1, createdAt: -1 });
movieReviewSchema.index({ movie: 1, rating: 1, isVerifiedViewer: 1, status: 1 });

const MovieReview = mongoose.model("MovieReview", movieReviewSchema);

export default MovieReview;
