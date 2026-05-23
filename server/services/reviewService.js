import Booking from "../models/Booking.js";
import MovieReview, { REVIEW_STATUS } from "../models/MovieReview.js";
import { BOOKING_STATUS, PAYMENT_STATUS } from "./bookingService.js";
import { getShowtimeLifecycle } from "./showtimeService.js";

export const buildReviewSummaryMap = async (movieIds = []) => {
    const normalizedMovieIds = [...new Set(movieIds.map((movieId) => `${movieId || ""}`).filter(Boolean))];

    if (normalizedMovieIds.length === 0) {
        return new Map();
    }

    const summaries = await MovieReview.aggregate([
        {
            $match: {
                movie: { $in: normalizedMovieIds },
                status: REVIEW_STATUS.VISIBLE,
                isVerifiedViewer: true,
                rating: { $ne: null }
            }
        },
        {
            $group: {
                _id: "$movie",
                averageRating: { $avg: "$rating" },
                ratingCount: { $sum: 1 }
            }
        }
    ]);

    return new Map(summaries.map((summary) => [
        summary._id,
        {
            averageRating: Math.round(summary.averageRating * 10) / 10,
            ratingCount: summary.ratingCount
        }
    ]));
};

export const attachReviewSummaries = async (movies = []) => {
    const summaryMap = await buildReviewSummaryMap(movies.map((movie) => movie?._id));

    return movies.map((movie) => {
        const plainMovie = typeof movie?.toObject === "function" ? movie.toObject() : movie;
        const summary = summaryMap.get(`${plainMovie?._id}`) || { averageRating: null, ratingCount: 0 };

        return {
            ...plainMovie,
            quickShowRating: summary.averageRating,
            quickShowRatingCount: summary.ratingCount
        };
    });
};

export const getMovieReviewSummary = async (movieId) => {
    const summaryMap = await buildReviewSummaryMap([movieId]);
    return summaryMap.get(`${movieId}`) || { averageRating: null, ratingCount: 0 };
};

export const ensureReviewableBooking = async ({ userId, movieId = "", bookingId }) => {
    const booking = await Booking.findOne({ _id: bookingId, user: userId })
        .populate({
            path: "show",
            populate: { path: "movie" }
        });

    if (!booking) {
        throw new Error("Không tìm thấy booking hợp lệ để đánh giá.");
    }

    if (booking.paymentStatus !== PAYMENT_STATUS.PAID || !booking.isPaid) {
        throw new Error("Chỉ booking đã thanh toán mới được đánh giá sao.");
    }

    if (![
        BOOKING_STATUS.CONFIRMED,
        BOOKING_STATUS.CHECKED_IN,
        BOOKING_STATUS.NO_SHOW
    ].includes(booking.bookingStatus)) {
        throw new Error("Booking này không đủ điều kiện đánh giá sao.");
    }

    const bookingMovieId = `${booking.show?.movie?._id || booking.show?.movie || ""}`;

    if (!booking.show || (movieId && bookingMovieId !== `${movieId}`)) {
        throw new Error("Booking không thuộc phim đang đánh giá.");
    }

    if (getShowtimeLifecycle(booking.show) !== "ENDED") {
        throw new Error("Bạn chỉ có thể đánh giá sao sau khi suất chiếu kết thúc.");
    }

    const existingRating = await MovieReview.exists({
        booking: booking._id,
        rating: { $ne: null }
    });

    if (existingRating) {
        throw new Error("Booking này đã được dùng để đánh giá sao.");
    }

    return booking;
};
