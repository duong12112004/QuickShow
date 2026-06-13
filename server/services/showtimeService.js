import axios from "axios";
import Movie from "../models/Movie.js";
import Room from "../models/Room.js";
import Show from "../models/Show.js";

export const DEFAULT_CLEANUP_MINUTES = 15;
export const SHOWTIME_STATUS = {
    SCHEDULED: "SCHEDULED",
    CANCELLED: "CANCELLED"
};

// Đọc một số bắt buộc lớn hơn 0, dùng cho giá vé và các giá trị dương.
const parsePositiveNumber = (value, fieldName) => {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        throw new Error(`${fieldName} phải là số lớn hơn 0.`);
    }

    return numericValue;
};

// Đọc số nguyên không âm, dùng cho thời gian dọn phòng.
const parseNonNegativeInteger = (value, fieldName) => {
    const numericValue = Number(value);

    if (!Number.isInteger(numericValue) || numericValue < 0) {
        throw new Error(`${fieldName} phải là số nguyên không âm.`);
    }

    return numericValue;
};

// Chuyển giá trị request thành Date hợp lệ.
const parseShowDateTime = (value) => {
    if (!value) {
        throw new Error("Thời gian chiếu là trường bắt buộc.");
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
        throw new Error("Thời gian chiếu không hợp lệ.");
    }

    return parsedDate;
};

// Chuyển định dạng tạo suất cũ [{ date, time: [] }] thành mảng Date theo giờ Việt Nam.
export const normalizeLegacyShowsInput = (showsInput = []) => {
    if (!Array.isArray(showsInput) || showsInput.length === 0) {
        throw new Error("Danh sách mốc chiếu không hợp lệ.");
    }

    return showsInput.flatMap((show) => {
        const date = `${show?.date || ""}`.trim();
        const times = Array.isArray(show?.time) ? show.time : [];

        return times.map((time) => {
            const normalizedTime = `${time || ""}`.trim();

            if (!date || !normalizedTime) {
                throw new Error("Danh sách mốc chiếu không hợp lệ.");
            }

            return parseShowDateTime(`${date}T${normalizedTime}+07:00`);
        });
    });
};

// Kiểm tra và chuẩn hóa payload tạo một hoặc nhiều suất chiếu.
export const validateCreateShowtimePayload = (body) => {
    const movieId = `${body.movieId || ""}`.trim();
    const roomId = `${body.roomId || ""}`.trim();

    if (!movieId) {
        throw new Error("Phim là trường bắt buộc.");
    }

    if (!roomId) {
        throw new Error("Phòng chiếu là trường bắt buộc.");
    }

    const basePrice = parsePositiveNumber(body.basePrice, "Giá vé");
    const cleanupMinutes = body.cleanupMinutes === undefined || body.cleanupMinutes === ""
        ? DEFAULT_CLEANUP_MINUTES
        : parseNonNegativeInteger(body.cleanupMinutes, "Thời gian dọn phòng");

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

// Chỉ chuẩn hóa các trường được gửi lên khi cập nhật suất chiếu.
export const validateUpdateShowtimePayload = (body) => {
    const payload = {};

    if (body.movieId !== undefined) {
        const movieId = `${body.movieId || ""}`.trim();
        if (!movieId) throw new Error("Phim là trường bắt buộc.");
        payload.movieId = movieId;
    }

    if (body.roomId !== undefined) {
        const roomId = `${body.roomId || ""}`.trim();
        if (!roomId) throw new Error("Phòng chiếu là trường bắt buộc.");
        payload.roomId = roomId;
    }

    if (body.showDateTime !== undefined) {
        payload.showDateTime = parseShowDateTime(body.showDateTime);
    }

    if (body.basePrice !== undefined) {
        payload.basePrice = parsePositiveNumber(body.basePrice, "Giá vé");
    }

    if (body.cleanupMinutes !== undefined) {
        payload.cleanupMinutes = parseNonNegativeInteger(body.cleanupMinutes, "Thời gian dọn phòng");
    }

    return payload;
};

// Bắt buộc admin nhập lý do khi hủy suất chiếu.
export const validateCancelShowtimePayload = (body) => {
    const cancellationReason = `${body?.cancellationReason || ""}`.trim();

    if (!cancellationReason) {
        throw new Error("Lý do hủy suất chiếu là trường bắt buộc.");
    }

    return { cancellationReason };
};

// Coi dữ liệu cũ chưa có status là suất chiếu SCHEDULED.
export const buildScheduledShowtimeFilter = () => ({
    $or: [
        { status: SHOWTIME_STATUS.SCHEDULED },
        { status: { $exists: false } },
        { status: null }
    ]
});

// Thời điểm kết thúc bao gồm cả thời lượng phim và thời gian dọn phòng.
export const calculateShowtimeEnd = (showDateTime, runtimeMinutes, cleanupMinutes = DEFAULT_CLEANUP_MINUTES) => {
    const start = new Date(showDateTime);
    return new Date(start.getTime() + (Number(runtimeMinutes) + Number(cleanupMinutes)) * 60 * 1000);
};

// Kiểm tra thời điểm bắt đầu đã nằm trong quá khứ hay chưa.
export const isShowtimeInPast = (showDateTime, now = new Date()) => {
    return new Date(showDateTime).getTime() < now.getTime();
};

// Kiểm tra suất chiếu đã bắt đầu, bao gồm đúng thời điểm bắt đầu.
export const hasStartedShowtime = (showDateTime, now = new Date()) => {
    return new Date(showDateTime).getTime() <= now.getTime();
};

// Cho biết suất đã có ghế bán hoặc đang được giữ, dùng để chặn sửa/xóa nguy hiểm.
export const hasBookingsOrHeldSeats = (showtime) => {
    const occupiedCount = Object.keys(showtime?.occupiedSeats || {}).length;
    const heldCount = Object.keys(showtime?.heldSeats || {}).length;
    return occupiedCount > 0 || heldCount > 0;
};

// Số ghế đã thanh toán được lưu trong occupiedSeats.
export const getPaidSeatCount = (showtime) => Object.keys(showtime?.occupiedSeats || {}).length;

// Suy ra vòng đời hiện tại của suất chiếu từ trạng thái, giờ bắt đầu và giờ kết thúc.
export const getShowtimeLifecycle = (showtime, now = new Date()) => {
    const startTime = new Date(showtime.showDateTime);
    const endTime = new Date(showtime.endDateTime || calculateShowtimeEnd(
        showtime.showDateTime,
        showtime.runtimeMinutes || showtime.movie?.runtime || 0,
        showtime.cleanupMinutes ?? DEFAULT_CLEANUP_MINUTES
    ));

    if (showtime.status === SHOWTIME_STATUS.CANCELLED) {
        return "CANCELLED";
    }

    if (endTime.getTime() <= now.getTime()) {
        return "ENDED";
    }

    if (startTime.getTime() <= now.getTime()) {
        return "IN_PROGRESS";
    }

    return "UPCOMING";
};

// Xác minh phòng tồn tại và đang hoạt động trước khi xếp lịch chiếu.
export const ensureRoomIsActive = async (roomId) => {
    const room = await Room.findById(roomId);

    if (!room) {
        throw new Error("Phòng chiếu không tồn tại trong hệ thống.");
    }

    if (room.status && room.status !== "ACTIVE") {
        throw new Error("Phòng chiếu đang bảo trì hoặc ngừng khai thác, không thể xếp suất chiếu.");
    }

    return room;
};

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";

// Header xác thực dùng chung cho các request TMDB.
const buildTmdbConfig = () => ({
    headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` }
});

const hasText = (value) => `${value || ""}`.trim().length > 0;

const pickText = (...values) => values.find(hasText) || "";

const pickArray = (...values) => values.find((value) => Array.isArray(value) && value.length > 0) || [];

const normalizeImdbRating = (value) => {
    const numericValue = Number.parseFloat(value);
    return Number.isFinite(numericValue) ? numericValue : null;
};

// Ưu tiên trailer YouTube chính thức, sau đó trailer, teaser và video khả dụng đầu tiên.
const pickTrailer = (...videoGroups) => {
    const videos = videoGroups
        .flatMap((group) => group?.results || [])
        .filter((video) => video.site === "YouTube" && video.key);

    return videos.find((video) => video.type === "Trailer" && video.official)
        || videos.find((video) => video.type === "Trailer")
        || videos.find((video) => video.type === "Teaser")
        || videos[0]
        || null;
};

// Lấy danh sách đạo diễn không trùng từ credits của TMDB.
const pickDirector = (credits) => {
    const directors = (credits?.crew || [])
        .filter((member) => member.job === "Director")
        .map((member) => member.name)
        .filter(Boolean);

    return [...new Set(directors)].join(", ");
};

// Tìm nhãn độ tuổi của một quốc gia trong release_dates.
const pickCertificationFromCountry = (releaseDates, countryCode) => {
    const countryRelease = (releaseDates?.results || []).find((item) => item.iso_3166_1 === countryCode);
    const certification = countryRelease?.release_dates
        ?.map((releaseDate) => releaseDate.certification)
        .find(hasText);

    return certification || "";
};

// Ưu tiên nhãn độ tuổi Việt Nam, nếu thiếu thì dùng nhãn Hoa Kỳ.
const pickCertification = (releaseDates) => {
    const vietnamCertification = pickCertificationFromCountry(releaseDates, "VN");

    if (vietnamCertification) {
        return {
            certification: vietnamCertification,
            certificationCountry: "VN"
        };
    }

    const usCertification = pickCertificationFromCountry(releaseDates, "US");

    if (usCertification) {
        return {
            certification: usCertification,
            certificationCountry: "US"
        };
    }

    return {
        certification: "",
        certificationCountry: ""
    };
};

// Lấy điểm IMDb từ OMDb; lỗi nguồn ngoài không được làm thất bại việc tạo phim.
const fetchOmdbRating = async (imdbId) => {
    if (!process.env.OMDB_API_KEY || !imdbId) {
        return {
            imdb_rating: null,
            imdb_votes: ""
        };
    }

    try {
        const { data } = await axios.get("https://www.omdbapi.com/", {
            params: {
                i: imdbId,
                apikey: process.env.OMDB_API_KEY
            }
        });

        if (data?.Response === "False") {
            return {
                imdb_rating: null,
                imdb_votes: ""
            };
        }

        return {
            imdb_rating: normalizeImdbRating(data.imdbRating),
            imdb_votes: data.imdbVotes || ""
        };
    } catch (error) {
        console.error(`[OMDb] Không thể lấy điểm IMDb cho ${imdbId}:`, error.message);
        return {
            imdb_rating: null,
            imdb_votes: ""
        };
    }
};

// Ghép metadata tiếng Việt/Anh từ TMDB và điểm IMDb từ OMDb thành document Movie hoàn chỉnh.
const buildMoviePayload = async (movieId) => {
    const [viResponse, enResponse] = await Promise.all([
        axios.get(`${TMDB_API_BASE_URL}/movie/${movieId}`, {
            ...buildTmdbConfig(),
            params: {
                language: "vi-VN",
                append_to_response: "credits,videos,external_ids,release_dates"
            }
        }),
        axios.get(`${TMDB_API_BASE_URL}/movie/${movieId}`, {
            ...buildTmdbConfig(),
            params: {
                language: "en-US",
                append_to_response: "videos,external_ids,release_dates"
            }
        })
    ]);

    const viData = viResponse.data;
    const enData = enResponse.data;
    const externalIds = viData.external_ids || enData.external_ids || {};
    const imdbId = externalIds.imdb_id || "";
    const imdbRating = await fetchOmdbRating(imdbId);
    const trailer = pickTrailer(viData.videos, enData.videos);
    const certification = pickCertification(viData.release_dates || enData.release_dates);

    return {
        _id: movieId,
        title: pickText(enData.title, viData.title, enData.original_title, viData.original_title),
        titleVi: pickText(viData.title, enData.title, viData.original_title, enData.original_title),
        overview: pickText(enData.overview, viData.overview),
        overviewVi: pickText(viData.overview, enData.overview),
        poster_path: pickText(viData.poster_path, enData.poster_path),
        backdrop_path: pickText(viData.backdrop_path, enData.backdrop_path),
        release_date: pickText(viData.release_date, enData.release_date),
        original_title: pickText(viData.original_title, enData.original_title),
        original_language: pickText(viData.original_language, enData.original_language),
        tagline: pickText(enData.tagline, viData.tagline),
        taglineVi: pickText(viData.tagline, enData.tagline),
        genres: pickArray(enData.genres, viData.genres),
        genresVi: pickArray(viData.genres, enData.genres),
        casts: viData.credits?.cast || [],
        vote_average: viData.vote_average || enData.vote_average || 0,
        vote_count: viData.vote_count || enData.vote_count || 0,
        imdb_id: imdbId,
        ...imdbRating,
        trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : "",
        trailerKey: trailer?.key || "",
        trailerSite: trailer?.site || "",
        director: pickDirector(viData.credits),
        ...certification,
        production_countries: pickArray(viData.production_countries, enData.production_countries),
        spoken_languages: pickArray(viData.spoken_languages, enData.spoken_languages),
        runtime: viData.runtime || enData.runtime || 0
    };
};

// Dữ liệu phim cũ thiếu các trường quan trọng sẽ được tải lại từ nguồn ngoài.
const shouldRefreshMovieMetadata = (movie) => {
    return !movie.titleVi
        || !movie.overviewVi
        || !movie.trailerUrl
        || !movie.director
        || !movie.imdb_id
        || !movie.certification;
};

// Lấy phim trong database; nếu chưa có hoặc thiếu metadata thì đồng bộ từ TMDB/OMDb.
export const ensureMovieExists = async (movieId) => {
    let movie = await Movie.findById(movieId);

    if (movie) {
        if (shouldRefreshMovieMetadata(movie)) {
            const moviePayload = await buildMoviePayload(movieId);
            movie.set(moviePayload);
            await movie.save();
        }

        return movie;
    }

    movie = await Movie.create(await buildMoviePayload(movieId));

    return movie;
};

// Chặn tạo hoặc chuyển suất chiếu về thời điểm đã qua.
export const assertShowtimeNotInPast = (showDateTime, now = new Date()) => {
    if (isShowtimeInPast(showDateTime, now)) {
        throw new Error("Không thể tạo hoặc cập nhật suất chiếu trong quá khứ.");
    }
};

// Lấy giờ kết thúc đã lưu hoặc tính lại cho dữ liệu suất chiếu cũ.
const getExistingShowtimeEnd = (showtime) => {
    return new Date(showtime.endDateTime || calculateShowtimeEnd(
        showtime.showDateTime,
        showtime.runtimeMinutes || showtime.movie?.runtime || 0,
        showtime.cleanupMinutes ?? DEFAULT_CLEANUP_MINUTES
    ));
};

// Chặn suất mới đè lịch các suất đã lưu trong cùng phòng, gồm cả thời gian dọn phòng.
export const assertNoShowtimeOverlap = async ({
    roomId,
    showDateTime,
    runtimeMinutes,
    cleanupMinutes = DEFAULT_CLEANUP_MINUTES,
    excludeShowtimeId = null
}) => {
    const nextEndDateTime = calculateShowtimeEnd(showDateTime, runtimeMinutes, cleanupMinutes);
    const query = {
        room: roomId,
        status: { $ne: SHOWTIME_STATUS.CANCELLED },
        showDateTime: { $lt: nextEndDateTime }
    };

    if (excludeShowtimeId) {
        query._id = { $ne: excludeShowtimeId };
    }

    const candidateShowtimes = await Show.find(query)
        .populate("movie", "runtime title")
        .populate("room", "name");

    const conflict = candidateShowtimes.find((candidate) => {
        const candidateEnd = getExistingShowtimeEnd(candidate);
        return candidateEnd.getTime() > new Date(showDateTime).getTime();
    });

    if (conflict) {
        const roomName = conflict.room?.name || "phòng đang chọn";
        const title = conflict.movie?.title || "một phim khác";
        const start = new Date(conflict.showDateTime).toLocaleString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
        const end = getExistingShowtimeEnd(conflict).toLocaleString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });

        throw new Error(`Lịch chiếu bị trùng với suất "${title}" tại ${roomName} (${start} - ${end}, đã tính runtime và thời gian dọn phòng).`);
    }
};

// Chặn các suất mới trong cùng một request đè lịch lẫn nhau trước khi lưu database.
export const assertNoLocalShowtimeOverlap = ({
    draftShowtimes,
    showDateTime,
    runtimeMinutes,
    cleanupMinutes = DEFAULT_CLEANUP_MINUTES
}) => {
    const nextStart = new Date(showDateTime);
    const nextEnd = calculateShowtimeEnd(showDateTime, runtimeMinutes, cleanupMinutes);

    const conflict = draftShowtimes.find((draft) => {
        const draftStart = new Date(draft.showDateTime);
        const draftEnd = new Date(draft.endDateTime || calculateShowtimeEnd(
            draft.showDateTime,
            draft.runtimeMinutes,
            draft.cleanupMinutes ?? DEFAULT_CLEANUP_MINUTES
        ));

        return draftStart.getTime() < nextEnd.getTime() && draftEnd.getTime() > nextStart.getTime();
    });

    if (conflict) {
        throw new Error("Danh sách suất chiếu mới đang bị đè lịch với nhau trong cùng phòng.");
    }
};

// Tạo document suất chiếu với thời gian kết thúc và trạng thái ghế ban đầu.
export const buildShowtimeSnapshot = ({
    movieId,
    roomId,
    showDateTime,
    basePrice,
    runtimeMinutes,
    cleanupMinutes = DEFAULT_CLEANUP_MINUTES
}) => ({
    movie: movieId,
    room: roomId,
    showDateTime: new Date(showDateTime),
    endDateTime: calculateShowtimeEnd(showDateTime, runtimeMinutes, cleanupMinutes),
    runtimeMinutes,
    cleanupMinutes,
    basePrice,
    status: SHOWTIME_STATUS.SCHEDULED,
    cancellationReason: "",
    cancelledAt: null,
    occupiedSeats: {},
    heldSeats: {}
});

// Chuẩn hóa suất chiếu thành dữ liệu quản trị kèm vòng đời và số ghế.
export const serializeAdminShowtime = (showtime, now = new Date()) => {
    const paidSeats = getPaidSeatCount(showtime);
    const heldSeats = Object.keys(showtime.heldSeats || {}).length;

    return {
        _id: showtime._id,
        movie: showtime.movie,
        room: showtime.room,
        showDateTime: showtime.showDateTime,
        endDateTime: showtime.endDateTime || calculateShowtimeEnd(
            showtime.showDateTime,
            showtime.runtimeMinutes || showtime.movie?.runtime || 0,
            showtime.cleanupMinutes ?? DEFAULT_CLEANUP_MINUTES
        ),
        runtimeMinutes: showtime.runtimeMinutes || showtime.movie?.runtime || 0,
        cleanupMinutes: showtime.cleanupMinutes ?? DEFAULT_CLEANUP_MINUTES,
        basePrice: showtime.basePrice,
        status: showtime.status || SHOWTIME_STATUS.SCHEDULED,
        lifecycle: getShowtimeLifecycle(showtime, now),
        cancellationReason: showtime.cancellationReason || "",
        cancelledAt: showtime.cancelledAt || null,
        soldSeatCount: paidSeats,
        heldSeatCount: heldSeats,
        hasSales: paidSeats > 0
    };
};
