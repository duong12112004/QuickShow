import { DEFAULT_CLEANUP_MINUTES } from "../services/showtimeService.js";

const parsePositiveNumber = (value, fieldName) => {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        throw new Error(`${fieldName} phai la so lon hon 0.`);
    }

    return numericValue;
};

const parseNonNegativeInteger = (value, fieldName) => {
    const numericValue = Number(value);

    if (!Number.isInteger(numericValue) || numericValue < 0) {
        throw new Error(`${fieldName} phai la so nguyen khong am.`);
    }

    return numericValue;
};

const parseShowDateTime = (value) => {
    if (!value) {
        throw new Error("Thoi gian chieu la truong bat buoc.");
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
        throw new Error("Thoi gian chieu khong hop le.");
    }

    return parsedDate;
};

export const normalizeLegacyShowsInput = (showsInput = []) => {
    if (!Array.isArray(showsInput) || showsInput.length === 0) {
        throw new Error("Danh sach moc chieu khong hop le.");
    }

    return showsInput.flatMap((show) => {
        const date = `${show?.date || ""}`.trim();
        const times = Array.isArray(show?.time) ? show.time : [];

        return times.map((time) => {
            const normalizedTime = `${time || ""}`.trim();

            if (!date || !normalizedTime) {
                throw new Error("Danh sach moc chieu khong hop le.");
            }

            return parseShowDateTime(`${date}T${normalizedTime}+07:00`);
        });
    });
};

export const validateCreateShowtimePayload = (body) => {
    const movieId = `${body.movieId || ""}`.trim();
    const roomId = `${body.roomId || ""}`.trim();

    if (!movieId) {
        throw new Error("Phim la truong bat buoc.");
    }

    if (!roomId) {
        throw new Error("Phong chieu la truong bat buoc.");
    }

    const basePrice = parsePositiveNumber(body.basePrice, "Gia ve");
    const cleanupMinutes = body.cleanupMinutes === undefined || body.cleanupMinutes === ""
        ? DEFAULT_CLEANUP_MINUTES
        : parseNonNegativeInteger(body.cleanupMinutes, "Thoi gian don phong");

    const showtimes = body.showDateTime
        ? [parseShowDateTime(body.showDateTime)]
        : normalizeLegacyShowsInput(body.showsInput);

    return {
        movieId,
        roomId,
        basePrice,
        cleanupMinutes,
        showtimes
    };
};

export const validateUpdateShowtimePayload = (body) => {
    const payload = {};

    if (body.movieId !== undefined) {
        const movieId = `${body.movieId || ""}`.trim();
        if (!movieId) throw new Error("Phim la truong bat buoc.");
        payload.movieId = movieId;
    }

    if (body.roomId !== undefined) {
        const roomId = `${body.roomId || ""}`.trim();
        if (!roomId) throw new Error("Phong chieu la truong bat buoc.");
        payload.roomId = roomId;
    }

    if (body.showDateTime !== undefined) {
        payload.showDateTime = parseShowDateTime(body.showDateTime);
    }

    if (body.basePrice !== undefined) {
        payload.basePrice = parsePositiveNumber(body.basePrice, "Gia ve");
    }

    if (body.cleanupMinutes !== undefined) {
        payload.cleanupMinutes = parseNonNegativeInteger(body.cleanupMinutes, "Thoi gian don phong");
    }

    return payload;
};

export const validateCancelShowtimePayload = (body) => {
    const cancellationReason = `${body?.cancellationReason || ""}`.trim();

    if (!cancellationReason) {
        throw new Error("Ly do huy suat chieu la truong bat buoc.");
    }

    return { cancellationReason };
};
