import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import { inngest } from "../inngest/index.js";
import {
    assertNoShowtimeOverlap,
    assertNoLocalShowtimeOverlap,
    assertShowtimeNotInPast,
    buildScheduledShowtimeFilter,
    buildShowtimeSnapshot,
    ensureMovieExists,
    ensureRoomIsActive,
    getShowtimeLifecycle,
    SHOWTIME_STATUS,
    validateCreateShowtimePayload
} from "../services/showtimeService.js";

export const getNowPlayingMovies = async (req, res) => {
    try {
        const { data } = await axios.get("https://api.themoviedb.org/3/movie/now_playing", {
            headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` }
        });

        res.json({ success: true, movies: data.results });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi lấy danh sách phim từ TMDB: " + error.message });
    }
};

export const addShow = async (req, res) => {
    try {
        const { movieId, roomId, basePrice, cleanupMinutes, showtimes } = validateCreateShowtimePayload(req.body);

        await ensureRoomIsActive(roomId);
        const movie = await ensureMovieExists(movieId);

        const showsToCreate = [];

        for (const showDateTime of showtimes) {
            assertShowtimeNotInPast(showDateTime);
            assertNoLocalShowtimeOverlap({
                draftShowtimes: showsToCreate,
                showDateTime,
                runtimeMinutes: movie.runtime,
                cleanupMinutes
            });
            await assertNoShowtimeOverlap({
                roomId,
                showDateTime,
                runtimeMinutes: movie.runtime,
                cleanupMinutes
            });

            showsToCreate.push(buildShowtimeSnapshot({
                movieId,
                roomId,
                showDateTime,
                basePrice,
                runtimeMinutes: movie.runtime,
                cleanupMinutes
            }));
        }

        if (showsToCreate.length > 0) {
            await Show.insertMany(showsToCreate);
        }

        await inngest.send({
            name: "app/show.added",
            data: { movieTitle: movie.title }
        });

        res.json({ success: true, message: "Thêm suất chiếu thành công." });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi thêm suất chiếu: " + error.message });
    }
};

export const getShows = async (req, res) => {
    try {
        const shows = await Show.find({
            showDateTime: { $gte: new Date() },
            ...buildScheduledShowtimeFilter()
        })
            .populate("movie")
            .populate("room")
            .sort({ showDateTime: 1 });

        const uniqueMoviesMap = new Map();

        shows
            .filter((show) => show.room && (!show.room.status || show.room.status === "ACTIVE"))
            .forEach((show) => {
                uniqueMoviesMap.set(show.movie._id.toString(), show.movie);
            });

        res.json({ success: true, shows: Array.from(uniqueMoviesMap.values()) });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tải danh sách phim: " + error.message });
    }
};

export const getShowSchedule = async (req, res) => {
    try {
        const shows = await Show.find({
            showDateTime: { $gte: new Date() },
            ...buildScheduledShowtimeFilter()
        })
            .populate("movie")
            .populate("room")
            .sort({ showDateTime: 1 });

        const scheduleMap = new Map();

        shows
            .filter((show) => show.movie && show.room && (!show.room.status || show.room.status === "ACTIVE"))
            .forEach((show) => {
                const date = new Date(show.showDateTime).toLocaleDateString("en-CA", {
                    timeZone: "Asia/Ho_Chi_Minh"
                });

                if (!scheduleMap.has(date)) {
                    scheduleMap.set(date, new Map());
                }

                const moviesMap = scheduleMap.get(date);
                const movieId = show.movie._id.toString();

                if (!moviesMap.has(movieId)) {
                    moviesMap.set(movieId, {
                        movie: show.movie,
                        showtimes: [],
                        minPrice: show.basePrice
                    });
                }

                const movieEntry = moviesMap.get(movieId);
                movieEntry.minPrice = Math.min(movieEntry.minPrice, show.basePrice);
                movieEntry.showtimes.push({
                    showId: show._id,
                    time: show.showDateTime,
                    roomName: show.room.name,
                    basePrice: show.basePrice
                });
            });

        const schedule = Array.from(scheduleMap.entries()).map(([date, moviesMap]) => ({
            date,
            movies: Array.from(moviesMap.values())
        }));

        res.json({ success: true, schedule });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tải lịch chiếu: " + error.message });
    }
};

export const getShow = async (req, res) => {
    try {
        const { movieId } = req.params;

        const shows = await Show.find({
            movie: movieId,
            showDateTime: { $gte: new Date() },
            ...buildScheduledShowtimeFilter()
        }).populate("room");

        const movie = await Movie.findById(movieId);
        const dateTime = {};

        shows
            .filter((show) => show.room && (!show.room.status || show.room.status === "ACTIVE"))
            .forEach((show) => {
                const date = new Date(show.showDateTime).toLocaleDateString("en-CA", {
                    timeZone: "Asia/Ho_Chi_Minh"
                });

                if (!dateTime[date]) {
                    dateTime[date] = [];
                }

                dateTime[date].push({
                    time: show.showDateTime,
                    showId: show._id,
                    roomName: show.room.name
                });
            });

        res.json({ success: true, movie, dateTime });
    } catch (error) {
        res.json({ success: false, message: "Lỗi khi tải chi tiết lịch chiếu: " + error.message });
    }
};

export const getSeatLayoutForShow = async (req, res) => {
    try {
        const { showId } = req.params;
        const show = await Show.findById(showId).populate("room");

        if (!show) {
            return res.json({ success: false, message: "Suất chiếu không tồn tại." });
        }

        if (!show.room) {
            return res.json({ success: false, message: "Phòng chiếu không tồn tại." });
        }

        if ((show.status || SHOWTIME_STATUS.SCHEDULED) === SHOWTIME_STATUS.CANCELLED) {
            return res.json({ success: false, message: "Suất chiếu này đã bị hủy." });
        }

        if (show.room.status && show.room.status !== "ACTIVE") {
            return res.json({
                success: false,
                message: "Phòng chiếu đang bảo trì hoặc ngừng khai thác."
            });
        }

        const lifecycle = getShowtimeLifecycle(show);
        if (lifecycle === "ENDED") {
            return res.json({ success: false, message: "Suất chiếu này đã kết thúc." });
        }

        const occupiedSeatsArray = show.occupiedSeats ? Object.keys(show.occupiedSeats) : [];
        const heldSeatsArray = show.heldSeats ? Object.keys(show.heldSeats) : [];

        res.json({
            success: true,
            roomName: show.room.name,
            basePrice: show.basePrice,
            seatMap: show.room.seatMap,
            occupiedSeats: occupiedSeatsArray,
            heldSeats: heldSeatsArray,
            status: show.status || SHOWTIME_STATUS.SCHEDULED,
            lifecycle
        });
    } catch (error) {
        res.json({ success: false, message: "Lỗi khi tải sơ đồ ghế: " + error.message });
    }
};
