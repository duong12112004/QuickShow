import mongoose from "mongoose";

export const SHOWTIME_STATUSES = ["SCHEDULED", "CANCELLED"];

const showSchema = new mongoose.Schema({
    movie: { type: String, required: true, ref: 'Movie' }, 
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    showDateTime: { type: Date, required: true },
    endDateTime: { type: Date },
    runtimeMinutes: { type: Number, min: 1 },
    cleanupMinutes: { type: Number, min: 0, default: 15 },
    basePrice: { type: Number, required: true }, 
    status: { type: String, enum: SHOWTIME_STATUSES, default: "SCHEDULED" },
    cancellationReason: { type: String, trim: true, default: "" },
    cancelledAt: { type: Date, default: null },
    occupiedSeats: { type: Object, default: {} } ,
    heldSeats: { type: Object, default: {} }
}, { minimize: false, timestamps: true });

const Show = mongoose.model("Show", showSchema);
export default Show;
