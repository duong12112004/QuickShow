import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
    name: { type: String, required: true }, // VD: "Cinema 1 - Màn hình cong"
    roomType: { type: String, enum: ['2D', '3D', 'IMAX'], default: '2D' },
    seatMap: [{
        row: { type: String, required: true },
        seats: [{
            seatNumber: { type: String, required: true },
            seatType: { type: String, enum: ['STANDARD', 'VIP', 'COUPLE', 'EMPTY'], default: 'STANDARD' },
        }]
    }]
}, { timestamps: true });

const Room = mongoose.model("Room", roomSchema);
export default Room;