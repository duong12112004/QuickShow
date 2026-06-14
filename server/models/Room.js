import mongoose from "mongoose";
import {
    applyRoomDerivedFields,
    ROOM_STATUSES,
    ROOM_TYPES,
    SEAT_TYPES
} from "../services/roomService.js";

const roomSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true },
    roomType: { type: String, enum: ROOM_TYPES, default: '2D' },
    status: { type: String, enum: ROOM_STATUSES, default: 'ACTIVE' },
    maintenanceNote: { type: String, trim: true, default: '' },
    capacity: { type: Number, min: 0, default: 0 },
    seatStats: {
        standard: { type: Number, min: 0, default: 0 },
        vip: { type: Number, min: 0, default: 0 },
        couple: { type: Number, min: 0, default: 0 },
        empty: { type: Number, min: 0, default: 0 },
        totalRows: { type: Number, min: 0, default: 0 }
    },
    seatMap: [{
        row: { type: String, required: true },
        seats: [{
            seatNumber: { type: String, required: true },
            seatType: { type: String, enum: SEAT_TYPES, default: 'STANDARD' }
        }]
    }]
}, { timestamps: true });

roomSchema.pre('validate', function () {
    applyRoomDerivedFields(this);
});

const Room = mongoose.model("Room", roomSchema);
export default Room;
