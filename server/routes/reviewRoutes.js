import express from "express";
import {
    createMovieComment,
    getMovieReviews,
    getReviewSummaries,
    rateBooking
} from "../controllers/reviewController.js";

const reviewRouter = express.Router();

reviewRouter.get("/summaries", getReviewSummaries);
reviewRouter.get("/movie/:movieId", getMovieReviews);
reviewRouter.post("/", createMovieComment);
reviewRouter.post("/rating", rateBooking);

export default reviewRouter;
