import mongoose from "mongoose";

const showSchema = new mongoose.Schema({
    movie: { type: String, required: true, ref: 'Movie' }, 
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    showDateTime: { type: Date, required: true },
    basePrice: { type: Number, required: true }, 
    occupiedSeats: { type: Object, default: {} } ,
    heldSeats: { type: Object, default: {} }
}, { minimize: false, timestamps: true });

const Show = mongoose.model("Show", showSchema);
export default Show;