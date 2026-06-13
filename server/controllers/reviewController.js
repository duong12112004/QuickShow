import { clerkClient } from "@clerk/express";
import Movie from "../models/Movie.js";
import MovieReview, { REVIEW_STATUS } from "../models/MovieReview.js";
import {
    attachReviewSummaries,
    ensureReviewableBooking,
    getMovieReviewSummary
} from "../services/reviewService.js";

// Lấy ID người dùng đã đăng nhập từ Clerk.
const ensureAuthenticatedUser = (req) => {
    const userId = req.auth?.()?.userId;

    if (!userId) {
        throw new Error("Vui lòng đăng nhập để tiếp tục.");
    }

    return userId;
};

// Chuẩn hóa nội dung bình luận trước khi lưu .
const normalizeComment = (value) => `${value || ""}`.trim();

// Chỉ chấp nhận điểm nguyên trong thang 1-10.
const normalizeRating = (value) => {
    const rating = Number(value);

    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
        throw new Error("Điểm đánh giá phải là số nguyên từ 1 đến 10.");
    }

    return rating;
};

// Lưu tên và ảnh tại thời điểm review để không phải gọi Clerk mỗi lần hiển thị.
const getUserSnapshot = async (userId) => {
    try {
        const user = await clerkClient.users.getUser(userId);
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

        return {
            userName: fullName || user.username || user.emailAddresses?.[0]?.emailAddress || "Người dùng QuickShow",
            userImage: user.imageUrl || ""
        };
    } catch {
        return {
            userName: "Người dùng QuickShow",
            userImage: ""
        };
    }
};

// Chỉ trả các trường review mà FE/admin cần sử dụng.
const serializeReview = (review) => ({
    _id: review._id,
    movie: review.movie,
    user: review.user,
    userName: review.userName,
    userImage: review.userImage,
    comment: review.comment,
    hasSpoiler: review.hasSpoiler,
    rating: review.rating,
    isVerifiedViewer: review.isVerifiedViewer,
    status: review.status,
    hiddenAt: review.hiddenAt,
    hiddenBy: review.hiddenBy,
    hiddenReason: review.hiddenReason,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    booking: review.booking,
    show: review.show
});

// Trả tối đa 100 bình luận công khai mới nhất của một phim.
export const getMovieReviews = async (req, res) => {
    try {
        const { movieId } = req.params;
        const movieExists = await Movie.exists({ _id: movieId });

        if (!movieExists) {
            return res.json({ success: false, message: "Không tìm thấy phim." });
        }

        const reviews = await MovieReview.find({
            movie: movieId,
            status: REVIEW_STATUS.VISIBLE,
            comment: { $ne: "" }
        }).sort({ createdAt: -1 }).limit(100);

        res.json({
            success: true,
            reviews: reviews.map(serializeReview)
        });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi tải bình luận: " + error.message });
    }
};

// Tạo bình luận tự do; không yêu cầu người dùng đã mua vé nên không được xác minh.
export const createMovieComment = async (req, res) => {
    try {
        const userId = ensureAuthenticatedUser(req);
        const movieId = `${req.body?.movieId || ""}`.trim();
        const comment = normalizeComment(req.body?.comment);
        const hasSpoiler = Boolean(req.body?.hasSpoiler);

        if (!movieId) {
            return res.json({ success: false, message: "Thiếu thông tin phim." });
        }

        const movieExists = await Movie.exists({ _id: movieId });
        if (!movieExists) {
            return res.json({ success: false, message: "Không tìm thấy phim." });
        }

        if (!comment) {
            return res.json({ success: false, message: "Vui lòng nhập bình luận." });
        }

        if (comment.length > 1500) {
            return res.json({ success: false, message: "Bình luận không được vượt quá 1500 ký tự." });
        }

        const userSnapshot = await getUserSnapshot(userId);
        const review = await MovieReview.create({
            movie: movieId,
            user: userId,
            ...userSnapshot,
            comment,
            hasSpoiler,
            rating: null,
            isVerifiedViewer: false
        });

        res.json({
            success: true,
            message: "Đã gửi bình luận của bạn.",
            review: serializeReview(review)
        });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi gửi bình luận: " + error.message });
    }
};

// Chấm điểm phim từ một booking hợp lệ, mỗi booking chỉ được dùng đánh giá một lần.
export const rateBooking = async (req, res) => {
    try {
        const userId = ensureAuthenticatedUser(req);
        const bookingId = `${req.body?.bookingId || ""}`.trim();
        const rating = normalizeRating(req.body?.rating);

        if (!bookingId) {
            return res.json({ success: false, message: "Thiếu thông tin booking." });
        }

        const booking = await ensureReviewableBooking({ userId, bookingId });
        const movieId = `${booking.show?.movie?._id || booking.show?.movie || ""}`;
        const userSnapshot = await getUserSnapshot(userId);
        const review = await MovieReview.create({
            movie: movieId,
            user: userId,
            ...userSnapshot,
            comment: "",
            hasSpoiler: false,
            rating,
            booking: booking._id,
            show: booking.show?._id,
            isVerifiedViewer: true
        });
        const summary = await getMovieReviewSummary(movieId);

        res.json({
            success: true,
            message: "Đã lưu điểm đánh giá của bạn.",
            review: serializeReview(review),
            summary
        });
    } catch (error) {
        console.error(error.message);
        const isDuplicateBooking = error?.code === 11000 && error?.keyPattern?.booking;
        res.json({
            success: false,
            message: isDuplicateBooking
                ? "Booking này đã được dùng để đánh giá sao."
                : "Lỗi khi gửi điểm đánh giá: " + error.message
        });
    }
};

// Gửi đồng thời điểm và bình luận từ một booking đã đủ điều kiện đánh giá.
export const submitBookingReview = async (req, res) => {
    try {
        const userId = ensureAuthenticatedUser(req);
        const bookingId = `${req.body?.bookingId || ""}`.trim();
        const rating = normalizeRating(req.body?.rating);
        const comment = normalizeComment(req.body?.comment);
        const hasSpoiler = Boolean(req.body?.hasSpoiler);

        if (!bookingId) {
            return res.json({ success: false, message: "Thiếu thông tin booking." });
        }

        if (comment.length > 1500) {
            return res.json({ success: false, message: "Bình luận không được vượt quá 1500 ký tự." });
        }

        const booking = await ensureReviewableBooking({ userId, bookingId });
        const movieId = `${booking.show?.movie?._id || booking.show?.movie || ""}`;
        const userSnapshot = await getUserSnapshot(userId);
        const review = await MovieReview.create({
            movie: movieId,
            user: userId,
            ...userSnapshot,
            comment,
            hasSpoiler: Boolean(comment) && hasSpoiler,
            rating,
            booking: booking._id,
            show: booking.show?._id,
            isVerifiedViewer: true
        });
        const summary = await getMovieReviewSummary(movieId);

        res.json({
            success: true,
            message: comment ? "Đã lưu đánh giá và bình luận của bạn." : "Đã lưu đánh giá của bạn.",
            review: serializeReview(review),
            summary
        });
    } catch (error) {
        console.error(error.message);
        const isDuplicateBooking = error?.code === 11000 && error?.keyPattern?.booking;
        res.json({
            success: false,
            message: isDuplicateBooking
                ? "Booking này đã được dùng để đánh giá phim."
                : "Lỗi khi gửi đánh giá: " + error.message
        });
    }
};

// Trả điểm trung bình và số lượt đánh giá cho nhiều phim trong một request.
export const getReviewSummaries = async (req, res) => {
    try {
        const movieIds = `${req.query?.movieIds || ""}`
            .split(",")
            .map((movieId) => movieId.trim())
            .filter(Boolean);
        const movies = movieIds.map((movieId) => ({ _id: movieId }));
        const moviesWithSummaries = await attachReviewSummaries(movies);

        res.json({
            success: true,
            summaries: moviesWithSummaries.reduce((result, movie) => {
                result[movie._id] = {
                    averageRating: movie.quickShowRating,
                    ratingCount: movie.quickShowRatingCount
                };
                return result;
            }, {})
        });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi tải điểm đánh giá: " + error.message });
    }
};

// Trả danh sách review cho admin, hỗ trợ lọc trạng thái và tìm kiếm nội dung.
export const getAdminReviews = async (req, res) => {
    try {
        const { status = "ALL", q = "" } = req.query || {};
        const query = {};

        if (status !== "ALL") {
            query.status = status;
        }

        const reviews = await MovieReview.find(query)
            .populate("movie", "title titleVi poster_path")
            .populate("booking", "bookingCode bookedSeats amount roomName movieTitle showDateTime bookingStatus paymentStatus")
            .populate({
                path: "show",
                select: "showDateTime room",
                populate: { path: "room", select: "name roomType" }
            })
            .sort({ createdAt: -1 })
            .limit(300);

        const normalizedSearch = `${q}`.trim().toLowerCase();
        const filteredReviews = normalizedSearch
            ? reviews.filter((review) => {
                const haystack = [
                    review.comment,
                    review.userName,
                    review.movie?.title,
                    review.movie?.titleVi
                ].join(" ").toLowerCase();
                return haystack.includes(normalizedSearch);
            })
            : reviews;

        res.json({
            success: true,
            reviews: filteredReviews.map(serializeReview)
        });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi tải danh sách bình luận: " + error.message });
    }
};

// Ẩn review khỏi phía khách hàng và lưu người/lý do thực hiện.
export const hideReview = async (req, res) => {
    try {
        const adminId = ensureAuthenticatedUser(req);
        const hiddenReason = normalizeComment(req.body?.hiddenReason) || "Ẩn bởi quản trị viên.";
        const review = await MovieReview.findById(req.params.reviewId);

        if (!review) {
            return res.json({ success: false, message: "Không tìm thấy bình luận." });
        }

        review.status = REVIEW_STATUS.HIDDEN;
        review.hiddenAt = new Date();
        review.hiddenBy = adminId;
        review.hiddenReason = hiddenReason;
        await review.save();

        res.json({ success: true, message: "Đã ẩn bình luận.", review: serializeReview(review) });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi ẩn bình luận: " + error.message });
    }
};

// Khôi phục review đã ẩn và xóa thông tin ẩn trước đó.
export const restoreReview = async (req, res) => {
    try {
        const review = await MovieReview.findById(req.params.reviewId);

        if (!review) {
            return res.json({ success: false, message: "Không tìm thấy bình luận." });
        }

        review.status = REVIEW_STATUS.VISIBLE;
        review.hiddenAt = null;
        review.hiddenBy = "";
        review.hiddenReason = "";
        await review.save();

        res.json({ success: true, message: "Đã khôi phục bình luận.", review: serializeReview(review) });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi khôi phục bình luận: " + error.message });
    }
};
