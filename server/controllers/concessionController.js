import Concession, {
    CONCESSION_CATEGORY,
    CONCESSION_STATUS
} from "../models/Concession.js";

const categoryValues = Object.values(CONCESSION_CATEGORY);
const statusValues = Object.values(CONCESSION_STATUS);

// Chuẩn hóa và kiểm tra dữ liệu món ăn từ request; partial=true cho phép cập nhật một phần.
const parseConcessionPayload = (body = {}, { partial = false } = {}) => {
    const payload = {};

    if (!partial || body.name !== undefined) {
        const name = `${body.name || ""}`.trim();
        if (!name) {
            throw new Error("Vui lòng nhập tên món hoặc combo.");
        }
        payload.name = name;
    }

    if (!partial || body.price !== undefined) {
        const price = Math.floor(Number(body.price || 0));
        if (!Number.isFinite(price) || price < 0) {
            throw new Error("Giá món không hợp lệ.");
        }
        payload.price = price;
    }

    if (body.description !== undefined) {
        payload.description = `${body.description || ""}`.trim();
    }

    if (body.imageUrl !== undefined) {
        payload.imageUrl = `${body.imageUrl || ""}`.trim();
    }

    if (!partial || body.category !== undefined) {
        const category = `${body.category || CONCESSION_CATEGORY.COMBO}`.trim().toUpperCase();
        if (!categoryValues.includes(category)) {
            throw new Error("Loại món không hợp lệ.");
        }
        payload.category = category;
    }

    if (!partial || body.status !== undefined) {
        const status = `${body.status || CONCESSION_STATUS.ACTIVE}`.trim().toUpperCase();
        if (!statusValues.includes(status)) {
            throw new Error("Trạng thái món không hợp lệ.");
        }
        payload.status = status;
    }

    if (body.sortOrder !== undefined) {
        const sortOrder = Number(body.sortOrder || 0);
        payload.sortOrder = Number.isFinite(sortOrder) ? sortOrder : 0;
    }

    return payload;
};

// Trả các món đang mở bán cho giao diện khách hàng, ưu tiên sortOrder thấp hơn.
export const getActiveConcessions = async (req, res) => {
    try {
        const concessions = await Concession.find({ status: CONCESSION_STATUS.ACTIVE })
            .sort({ sortOrder: 1, createdAt: -1 });

        res.json({ success: true, concessions });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi tải danh sách đồ ăn: " + error.message });
    }
};

// Trả toàn bộ món, bao gồm món đã ngừng bán, cho trang quản trị.
export const getAdminConcessions = async (req, res) => {
    try {
        const concessions = await Concession.find({})
            .sort({ sortOrder: 1, createdAt: -1 });

        res.json({ success: true, concessions });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi tải danh sách đồ ăn: " + error.message });
    }
};

// Kiểm tra payload rồi tạo món ăn/combo mới.
export const createConcession = async (req, res) => {
    try {
        const payload = parseConcessionPayload(req.body);
        const concession = await Concession.create(payload);

        res.json({
            success: true,
            message: "Đã tạo món ăn kèm thành công.",
            concession
        });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi tạo món ăn kèm: " + error.message });
    }
};

// Cập nhật các trường được gửi lên mà không bắt buộc client gửi lại toàn bộ món.
export const updateConcession = async (req, res) => {
    try {
        const payload = parseConcessionPayload(req.body, { partial: true });
        const concession = await Concession.findByIdAndUpdate(
            req.params.concessionId,
            payload,
            { new: true }
        );

        if (!concession) {
            return res.json({ success: false, message: "Không tìm thấy món ăn kèm." });
        }

        res.json({
            success: true,
            message: "Đã cập nhật món ăn kèm thành công.",
            concession
        });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi cập nhật món ăn kèm: " + error.message });
    }
};

// Xóa món khỏi danh mục quản trị; snapshot món trong booking cũ vẫn được giữ.
export const deleteConcession = async (req, res) => {
    try {
        const concession = await Concession.findByIdAndDelete(req.params.concessionId);

        if (!concession) {
            return res.json({ success: false, message: "Không tìm thấy món ăn kèm." });
        }

        res.json({ success: true, message: "Đã xóa món ăn kèm thành công." });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: "Lỗi khi xóa món ăn kèm: " + error.message });
    }
};
