import express from "express";
import {
    createMovieComment,
    getMovieReviews,
    getReviewSummaries,
    rateBooking,
    submitBookingReview
} from "../controllers/reviewController.js";

const reviewRouter = express.Router();

reviewRouter.get("/summaries", getReviewSummaries);
reviewRouter.get("/movie/:movieId", getMovieReviews);
reviewRouter.post("/", createMovieComment);
reviewRouter.post("/booking", submitBookingReview);
reviewRouter.post("/rating", rateBooking);

export default reviewRouter;
