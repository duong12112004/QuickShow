import Room from "../models/Room.js";
import Show from "../models/Show.js";
import {
    buildRoomErrorMessage,
    buildSeatLayoutStats,
    enrichRoomsWithUsage,
    generateSeatMapByRoomType,
    getRoomUsage,
    validateRoomPayload
} from "../services/roomService.js";

export const seedCinemaData = async (req, res) => {
    try {
        const totalShowsCount = await Show.countDocuments();

        if (totalShowsCount > 0) {
            return res.json({
                success: false,
                message: "Không thể seed lại phòng chiếu khi hệ thống đã có suất chiếu. Hãy dùng trên môi trường dev sạch."
            });
        }

        await Room.deleteMany({});

        const roomTypesToSeed = [
            { name: "Cinema 1", roomType: "2D" },
            { name: "Cinema 2", roomType: "2D" },
            { name: "Cinema 3", roomType: "3D" },
            { name: "IMAX 4", roomType: "IMAX" },
            { name: "Gold Class 5", roomType: "GOLD_CLASS" },
            { name: "Sweetbox 6", roomType: "SWEETBOX" }
        ];

        const roomsToCreate = roomTypesToSeed.map((room) => ({
            ...room,
            seatMap: generateSeatMapByRoomType(room.roomType)
        }));

        const newRooms = await Room.insertMany(roomsToCreate);

        res.json({
            success: true,
            message: "Đã khởi tạo thành công dữ liệu cho 6 phòng chiếu.",
            rooms: newRooms
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tạo dữ liệu phòng chiếu: " + error.message });
    }
};

export const getAllRooms = async (req, res) => {
    try {
        const rooms = await Room.find({})
            .sort({ name: 1 })
            .lean();

        const roomsWithUsage = await enrichRoomsWithUsage(rooms);

        res.json({ success: true, rooms: roomsWithUsage });
    } catch (error) {
        res.json({ success: false, message: "Lỗi khi tải danh sách phòng chiếu: " + error.message });
    }
};

export const getRoomDetail = async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await Room.findById(roomId).lean();

        if (!room) {
            return res.json({ success: false, message: "Phòng chiếu không tồn tại." });
        }

        const usage = await getRoomUsage(roomId);

        res.json({
            success: true,
            room: {
                ...room,
                status: room.status || "ACTIVE",
                maintenanceNote: room.maintenanceNote || "",
                capacity: room.capacity ?? buildSeatLayoutStats(room.seatMap || []).capacity,
                ...usage,
                canEditSeatMap: usage.futureShowsCount === 0,
                canDelete: usage.totalShowsCount === 0
            }
        });
    } catch (error) {
        res.json({ success: false, message: "Lỗi khi tải chi tiết phòng chiếu: " + error.message });
    }
};

export const createRoom = async (req, res) => {
    try {
        const payload = validateRoomPayload(req.body, { requireName: true });
        payload.seatMap = generateSeatMapByRoomType(payload.roomType || "2D");

        const room = await Room.create(payload);

        res.json({
            success: true,
            message: "Đã tạo phòng chiếu thành công.",
            room
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: buildRoomErrorMessage("Lỗi khi tạo phòng chiếu", error) });
    }
};

export const updateRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await Room.findById(roomId);

        if (!room) {
            return res.json({ success: false, message: "Phòng chiếu không tồn tại." });
        }

        const payload = validateRoomPayload(req.body);
        const usage = await getRoomUsage(roomId);

        const isSeatMapChanging = req.body.seatMap !== undefined;
        const isRoomTypeChanging = payload.roomType && payload.roomType !== room.roomType;
        const isPuttingRoomUnavailable = payload.status && payload.status !== "ACTIVE" && payload.status !== room.status;
        const shouldRegenerateSeatMap = isSeatMapChanging || isRoomTypeChanging;

        if (shouldRegenerateSeatMap && usage.futureShowsCount > 0) {
            return res.json({
                success: false,
                message: "Không thể sửa sơ đồ ghế hoặc loại phòng khi phòng đang còn suất chiếu sắp tới."
            });
        }

        if (isPuttingRoomUnavailable && usage.futureShowsCount > 0) {
            return res.json({
                success: false,
                message: "Cần xử lý hoặc hủy các suất chiếu sắp tới trước khi đưa phòng vào bảo trì hoặc ngừng khai thác."
            });
        }

        if (shouldRegenerateSeatMap) {
            payload.seatMap = generateSeatMapByRoomType(payload.roomType || room.roomType);
        }

        Object.assign(room, payload);
        await room.save();

        res.json({
            success: true,
            message: "Đã cập nhật phòng chiếu thành công.",
            room
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: buildRoomErrorMessage("Lỗi khi cập nhật phòng chiếu", error) });
    }
};

export const updateRoomStatus = async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await Room.findById(roomId);

        if (!room) {
            return res.json({ success: false, message: "Phòng chiếu không tồn tại." });
        }

        const payload = validateRoomPayload(req.body);

        if (!payload.status) {
            return res.json({ success: false, message: "Trạng thái phòng chiếu là trường bắt buộc." });
        }

        const usage = await getRoomUsage(roomId);

        if (payload.status !== "ACTIVE" && payload.status !== room.status && usage.futureShowsCount > 0) {
            return res.json({
                success: false,
                message: "Không thể đổi trạng thái phòng khi vẫn còn suất chiếu sắp tới."
            });
        }

        room.status = payload.status;
        room.maintenanceNote = payload.maintenanceNote || "";
        await room.save();

        res.json({
            success: true,
            message: "Đã cập nhật trạng thái phòng chiếu thành công.",
            room
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: buildRoomErrorMessage("Lỗi khi cập nhật trạng thái phòng chiếu", error) });
    }
};

export const deleteRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await Room.findById(roomId);

        if (!room) {
            return res.json({ success: false, message: "Phòng chiếu không tồn tại." });
        }

        const usage = await getRoomUsage(roomId);

        if (usage.totalShowsCount > 0) {
            return res.json({
                success: false,
                message: "Không thể xóa phòng đã từng được gắn với suất chiếu. Hãy chuyển sang INACTIVE để ngừng khai thác."
            });
        }

        await Room.findByIdAndDelete(roomId);

        res.json({
            success: true,
            message: "Đã xóa phòng chiếu thành công."
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi xóa phòng chiếu: " + error.message });
    }
};
