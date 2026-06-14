import mongoose from "mongoose";

export const REVIEW_STATUS = {
    VISIBLE: "VISIBLE",
    HIDDEN: "HIDDEN"
};

const movieReviewSchema = new mongoose.Schema({
    movie: { type: String, required: true, ref: "Movie", index: true },
    user: { type: String, required: true, index: true },
    userName: { type: String, default: "" },
    userImage: { type: String, default: "" },
    comment: { type: String, trim: true, default: "" },
    hasSpoiler: { type: Boolean, default: false },
    rating: { type: Number, min: 1, max: 10, default: null },
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        unique: true,
        sparse: true
    },
    show: { type: mongoose.Schema.Types.ObjectId, ref: "Show", default: null },
    isVerifiedViewer: { type: Boolean, default: false },
    status: {
        type: String,
        enum: Object.values(REVIEW_STATUS),
        default: REVIEW_STATUS.VISIBLE,
        index: true
    },
    hiddenAt: { type: Date, default: null },
    hiddenBy: { type: String, default: "" },
    hiddenReason: { type: String, trim: true, default: "" }
}, { timestamps: true });

movieReviewSchema.index({ movie: 1, status: 1, createdAt: -1 });
movieReviewSchema.index({ movie: 1, rating: 1, isVerifiedViewer: 1, status: 1 });

const MovieReview = mongoose.model("MovieReview", movieReviewSchema);

export default MovieReview;
