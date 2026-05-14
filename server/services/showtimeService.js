import axios from "axios";
import Movie from "../models/Movie.js";
import Room from "../models/Room.js";
import Show from "../models/Show.js";

export const DEFAULT_CLEANUP_MINUTES = 15;
export const SHOWTIME_STATUS = {
    SCHEDULED: "SCHEDULED",
    CANCELLED: "CANCELLED"
};

export const calculateShowtimeEnd = (showDateTime, runtimeMinutes, cleanupMinutes = DEFAULT_CLEANUP_MINUTES) => {
    const start = new Date(showDateTime);
    return new Date(start.getTime() + (Number(runtimeMinutes) + Number(cleanupMinutes)) * 60 * 1000);
};

export const isShowtimeInPast = (showDateTime, now = new Date()) => {
    return new Date(showDateTime).getTime() < now.getTime();
};

export const hasStartedShowtime = (showDateTime, now = new Date()) => {
    return new Date(showDateTime).getTime() <= now.getTime();
};

export const hasBookingsOrHeldSeats = (showtime) => {
    const occupiedCount = Object.keys(showtime?.occupiedSeats || {}).length;
    const heldCount = Object.keys(showtime?.heldSeats || {}).length;
    return occupiedCount > 0 || heldCount > 0;
};

export const getPaidSeatCount = (showtime) => Object.keys(showtime?.occupiedSeats || {}).length;

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

export const ensureRoomIsActive = async (roomId) => {
    const room = await Room.findById(roomId);

    if (!room) {
        throw new Error("Phong chieu khong ton tai trong he thong.");
    }

    if (room.status && room.status !== "ACTIVE") {
        throw new Error("Phong chieu dang bao tri hoac ngung khai thac, khong the xep suat chieu.");
    }

    return room;
};

export const ensureMovieExists = async (movieId) => {
    let movie = await Movie.findById(movieId);

    if (movie) {
        return movie;
    }

    const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
        axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
            headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` }
        }),
        axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
            headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` }
        })
    ]);

    const movieApiData = movieDetailsResponse.data;
    const movieCreditsData = movieCreditsResponse.data;

    movie = await Movie.create({
        _id: movieId,
        title: movieApiData.title,
        overview: movieApiData.overview,
        poster_path: movieApiData.poster_path,
        backdrop_path: movieApiData.backdrop_path,
        genres: movieApiData.genres,
        casts: movieCreditsData.cast,
        release_date: movieApiData.release_date,
        original_language: movieApiData.original_language,
        tagline: movieApiData.tagline || "",
        vote_average: movieApiData.vote_average,
        runtime: movieApiData.runtime
    });

    return movie;
};

export const assertShowtimeNotInPast = (showDateTime, now = new Date()) => {
    if (isShowtimeInPast(showDateTime, now)) {
        throw new Error("Khong the tao hoac cap nhat suat chieu trong qua khu.");
    }
};

const getExistingShowtimeEnd = (showtime) => {
    return new Date(showtime.endDateTime || calculateShowtimeEnd(
        showtime.showDateTime,
        showtime.runtimeMinutes || showtime.movie?.runtime || 0,
        showtime.cleanupMinutes ?? DEFAULT_CLEANUP_MINUTES
    ));
};

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
        const roomName = conflict.room?.name || "phong dang chon";
        const title = conflict.movie?.title || "mot phim khac";
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

        throw new Error(`Lich chieu bi trung voi suat "${title}" tai ${roomName} (${start} - ${end}, da tinh runtime va thoi gian don phong).`);
    }
};

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
        throw new Error("Danh sach suat chieu moi dang bi de lich voi nhau trong cung phong.");
    }
};

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
