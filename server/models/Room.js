import mongoose from "mongoose";

export const ROOM_TYPES = ['2D', '3D', 'IMAX', 'GOLD_CLASS', 'SWEETBOX'];
export const ROOM_STATUSES = ['ACTIVE', 'MAINTENANCE', 'INACTIVE'];
export const SEAT_TYPES = ['STANDARD', 'VIP', 'COUPLE', 'EMPTY'];

export const normalizeSeatMap = (seatMap = []) => {
    if (!Array.isArray(seatMap) || seatMap.length === 0) {
        throw new Error("So do ghe phai la mot mang va khong duoc de trong.");
    }

    const seenRows = new Set();
    const seenSeats = new Set();

    return seatMap.map((rowObj, rowIndex) => {
        const row = `${rowObj?.row || ''}`.trim().toUpperCase();

        if (!row) {
            throw new Error(`Hang ghe tai vi tri ${rowIndex + 1} khong hop le.`);
        }

        if (seenRows.has(row)) {
            throw new Error(`Hang ghe ${row} dang bi trung.`);
        }

        seenRows.add(row);

        const seats = Array.isArray(rowObj?.seats) ? rowObj.seats : [];
        const normalizedSeats = seats.map((seat, seatIndex) => {
            const seatNumber = `${seat?.seatNumber || ''}`.trim().toUpperCase();
            const seatType = `${seat?.seatType || 'STANDARD'}`.trim().toUpperCase();

            if (!seatNumber) {
                throw new Error(`Ghe tai hang ${row} vi tri ${seatIndex + 1} khong hop le.`);
            }

            if (!SEAT_TYPES.includes(seatType)) {
                throw new Error(`Loai ghe ${seatType} tai ${seatNumber} khong duoc ho tro.`);
            }

            if (seenSeats.has(seatNumber)) {
                throw new Error(`Ma ghe ${seatNumber} dang bi trung.`);
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

roomSchema.pre('validate', function (next) {
    try {
        const normalizedSeatMap = normalizeSeatMap(this.seatMap || []);
        const seatStats = buildSeatLayoutStats(normalizedSeatMap);

        if (seatStats.capacity <= 0) {
            throw new Error("Phong chieu phai co it nhat mot ghe kha dung.");
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

        next();
    } catch (error) {
        next(error);
    }
});

roomSchema.index({ name: 1 }, { unique: true });

const Room = mongoose.model("Room", roomSchema);
export default Room;
