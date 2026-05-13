import Show from "../models/Show.js";

export const ROOM_TYPES = ['2D', '3D', 'IMAX', 'GOLD_CLASS', 'SWEETBOX'];
export const ROOM_STATUSES = ['ACTIVE', 'MAINTENANCE', 'INACTIVE'];
export const SEAT_TYPES = ['STANDARD', 'VIP', 'COUPLE', 'EMPTY'];

export const getTemplateForRoomType = (roomType = '2D') => {
    if (roomType === 'IMAX') return 'IMAX';
    if (roomType === 'GOLD_CLASS' || roomType === 'SWEETBOX') return 'GOLD_CLASS';
    return 'STANDARD';
};

const generateStandardMap = () => {
    const seatMap = [];
    const rows = ['A', 'B', 'SPACE1', 'C', 'D', 'E', 'SPACE2', 'F', 'G'];

    rows.forEach((rowLabel) => {
        if (rowLabel.startsWith('SPACE')) {
            seatMap.push({ row: rowLabel, seats: [] });
            return;
        }

        const seats = [];
        let type = 'STANDARD';
        if (['C', 'D', 'E'].includes(rowLabel)) type = 'VIP';
        if (['F', 'G'].includes(rowLabel)) type = 'COUPLE';

        for (let i = 1; i <= 8; i += 1) {
            if (['C', 'D', 'E', 'F', 'G'].includes(rowLabel) && i === 5) {
                seats.push({ seatNumber: `GAP-${rowLabel}`, seatType: 'EMPTY' });
            }
            seats.push({ seatNumber: `${rowLabel}${i}`, seatType: type });
        }

        seatMap.push({ row: rowLabel, seats });
    });

    return seatMap;
};

const generateIMAXMap = () => {
    const seatMap = [];
    const rows = ['A', 'B', 'C', 'SPACE1', 'D', 'E', 'F', 'G', 'SPACE2', 'H', 'I'];

    rows.forEach((rowLabel) => {
        if (rowLabel.startsWith('SPACE')) {
            seatMap.push({ row: rowLabel, seats: [] });
            return;
        }

        const seats = [];
        let type = 'STANDARD';
        if (['D', 'E', 'F', 'G'].includes(rowLabel)) type = 'VIP';
        if (['H', 'I'].includes(rowLabel)) type = 'COUPLE';

        for (let i = 1; i <= 10; i += 1) {
            if (['D', 'E', 'F', 'G', 'H', 'I'].includes(rowLabel) && i === 6) {
                seats.push({ seatNumber: `GAP-${rowLabel}`, seatType: 'EMPTY' });
            }
            seats.push({ seatNumber: `${rowLabel}${i}`, seatType: type });
        }

        seatMap.push({ row: rowLabel, seats });
    });

    return seatMap;
};

const generateGoldClassMap = () => {
    const seatMap = [];
    const rows = ['A', 'B', 'C', 'SPACE1', 'D', 'E'];

    rows.forEach((rowLabel) => {
        if (rowLabel.startsWith('SPACE')) {
            seatMap.push({ row: rowLabel, seats: [] });
            return;
        }

        const seats = [];
        let type = 'VIP';
        if (['D', 'E'].includes(rowLabel)) type = 'COUPLE';

        for (let i = 1; i <= 6; i += 1) {
            if (i === 4) {
                seats.push({ seatNumber: `GAP-${rowLabel}`, seatType: 'EMPTY' });
            }
            seats.push({ seatNumber: `${rowLabel}${i}`, seatType: type });
        }

        seatMap.push({ row: rowLabel, seats });
    });

    return seatMap;
};

export const generateSeatMapByRoomType = (roomType = '2D') => {
    const template = getTemplateForRoomType(roomType);

    if (template === 'IMAX') return generateIMAXMap();
    if (template === 'GOLD_CLASS') return generateGoldClassMap();
    return generateStandardMap();
};

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

export const applyRoomDerivedFields = (roomDoc) => {
    const normalizedSeatMap = normalizeSeatMap(roomDoc.seatMap || []);
    const seatStats = buildSeatLayoutStats(normalizedSeatMap);

    if (seatStats.capacity <= 0) {
        throw new Error("Phòng chiếu phải có ít nhất một ghế khả dụng.");
    }

    roomDoc.seatMap = normalizedSeatMap;
    roomDoc.capacity = seatStats.capacity;
    roomDoc.seatStats = {
        standard: seatStats.standard,
        vip: seatStats.vip,
        couple: seatStats.couple,
        empty: seatStats.empty,
        totalRows: seatStats.totalRows
    };

    if (roomDoc.status === 'ACTIVE') {
        roomDoc.maintenanceNote = '';
    }
};

export const validateRoomPayload = (body, options = {}) => {
    const { requireName = false } = options;
    const payload = {};

    if (body.name !== undefined || requireName) {
        const name = `${body.name || ''}`.trim();
        if (!name) {
            throw new Error("Tên phòng chiếu không được để trống.");
        }
        payload.name = name;
    }

    if (body.roomType !== undefined) {
        const roomType = `${body.roomType || ''}`.trim().toUpperCase();
        if (!ROOM_TYPES.includes(roomType)) {
            throw new Error("Loại phòng chiếu không hợp lệ.");
        }
        payload.roomType = roomType;
    }

    if (body.status !== undefined) {
        const status = `${body.status || ''}`.trim().toUpperCase();
        if (!ROOM_STATUSES.includes(status)) {
            throw new Error("Trạng thái phòng chiếu không hợp lệ.");
        }
        payload.status = status;
    }

    if (body.maintenanceNote !== undefined || payload.status === 'MAINTENANCE') {
        const maintenanceNote = `${body.maintenanceNote || ''}`.trim();

        if (payload.status === 'MAINTENANCE' && !maintenanceNote) {
            throw new Error("Cần nhập lý do bảo trì khi chuyển phòng sang trạng thái bảo trì.");
        }

        payload.maintenanceNote = maintenanceNote;
    }

    if (body.seatMap !== undefined) {
        payload.seatMap = normalizeSeatMap(body.seatMap);
    }

    return payload;
};

export const buildRoomErrorMessage = (fallbackMessage, error) => {
    if (error?.code === 11000) {
        return "Tên phòng chiếu đã tồn tại trong hệ thống.";
    }

    return `${fallbackMessage}: ${error.message}`;
};

export const getRoomUsage = async (roomId) => {
    const now = new Date();

    const [totalShowsCount, futureShowsCount, nextShow] = await Promise.all([
        Show.countDocuments({ room: roomId }),
        Show.countDocuments({ room: roomId, showDateTime: { $gte: now } }),
        Show.findOne({ room: roomId, showDateTime: { $gte: now } })
            .sort({ showDateTime: 1 })
            .select("showDateTime")
            .lean()
    ]);

    return {
        totalShowsCount,
        futureShowsCount,
        nextShowTime: nextShow?.showDateTime || null
    };
};

export const enrichRoomsWithUsage = async (rooms) => {
    const now = new Date();
    const roomIds = rooms.map((room) => room._id);

    const [futureShows, totalShows] = await Promise.all([
        Show.aggregate([
            { $match: { room: { $in: roomIds }, showDateTime: { $gte: now } } },
            {
                $group: {
                    _id: "$room",
                    futureShowsCount: { $sum: 1 },
                    nextShowTime: { $min: "$showDateTime" }
                }
            }
        ]),
        Show.aggregate([
            { $match: { room: { $in: roomIds } } },
            {
                $group: {
                    _id: "$room",
                    totalShowsCount: { $sum: 1 }
                }
            }
        ])
    ]);

    const futureShowMap = new Map(
        futureShows.map((item) => [item._id.toString(), item])
    );
    const totalShowMap = new Map(
        totalShows.map((item) => [item._id.toString(), item.totalShowsCount])
    );

    return rooms.map((room) => {
        const futureShowData = futureShowMap.get(room._id.toString());

        return {
            ...room,
            status: room.status || 'ACTIVE',
            maintenanceNote: room.maintenanceNote || '',
            capacity: room.capacity ?? buildSeatLayoutStats(room.seatMap || []).capacity,
            futureShowsCount: futureShowData?.futureShowsCount || 0,
            nextShowTime: futureShowData?.nextShowTime || null,
            totalShowsCount: totalShowMap.get(room._id.toString()) || 0
        };
    });
};
