import mongoose from "mongoose";

export const ROOM_TYPES = ['2D', '3D', 'IMAX', 'GOLD_CLASS', 'SWEETBOX'];
export const ROOM_STATUSES = ['ACTIVE', 'MAINTENANCE', 'INACTIVE'];
export const SEAT_TYPES = ['STANDARD', 'VIP', 'COUPLE', 'EMPTY'];

export const normalizeSeatMap = (seatMap = []) => {
    if (!Array.isArray(seatMap) || seatMap.length === 0) {
        throw new Error("Sơ đồ ghế phải là một mảng và không được để trống.");
    }

    const seenRows = new Set();
    const seenSeats = new Set();

    return seatMap.map((rowObj, rowIndex) => {
        const row = `${rowObj?.row || ''}`.trim().toUpperCase();

        if (!row) {
            throw new Error(`Hàng ghế tại vị trí ${rowIndex + 1} không hợp lệ.`);
        }

        if (seenRows.has(row)) {
            throw new Error(`Hàng ghế ${row} đang bị trùng.`);
        }

        seenRows.add(row);

        const seats = Array.isArray(rowObj?.seats) ? rowObj.seats : [];
        const normalizedSeats = seats.map((seat, seatIndex) => {
            const seatNumber = `${seat?.seatNumber || ''}`.trim().toUpperCase();
            const seatType = `${seat?.seatType || 'STANDARD'}`.trim().toUpperCase();

            if (!seatNumber) {
                throw new Error(`Ghế tại hàng ${row} vị trí ${seatIndex + 1} không hợp lệ.`);
            }

            if (!SEAT_TYPES.includes(seatType)) {
                throw new Error(`Loại ghế ${seatType} tại ${seatNumber} không được hỗ trợ.`);
            }

            if (seenSeats.has(seatNumber)) {
                throw new Error(`Mã ghế ${seatNumber} đang bị trùng.`);
            }

            seenSeats.add(seatNumber);

            return { seatNumber, seatType };
        });

        return {
            row,
            seats: normalizedSeats
        };
    });
};

export const buildSeatLayoutStats = (seatMap = []) => {
    const stats = {
        standard: 0,
        vip: 0,
        couple: 0,
        empty: 0,
        totalRows: seatMap.length
    };

    seatMap.forEach((row) => {
        row.seats.forEach((seat) => {
            if (seat.seatType === 'STANDARD') stats.standard += 1;
            if (seat.seatType === 'VIP') stats.vip += 1;
            if (seat.seatType === 'COUPLE') stats.couple += 1;
            if (seat.seatType === 'EMPTY') stats.empty += 1;
        });
    });

    return {
        ...stats,
        capacity: stats.standard + stats.vip + stats.couple
    };
};

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
    const normalizedSeatMap = normalizeSeatMap(this.seatMap || []);
    const seatStats = buildSeatLayoutStats(normalizedSeatMap);

    if (seatStats.capacity <= 0) {
        throw new Error("Phòng chiếu phải có ít nhất một ghế khả dụng.");
    }

    this.seatMap = normalizedSeatMap;
    this.capacity = seatStats.capacity;
    this.seatStats = {
        standard: seatStats.standard,
        vip: seatStats.vip,
        couple: seatStats.couple,
        empty: seatStats.empty,
        totalRows: seatStats.totalRows
    };

    if (this.status === 'ACTIVE') {
        this.maintenanceNote = '';
    }
});

const Room = mongoose.model("Room", roomSchema);
export default Room;
