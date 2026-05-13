import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import Room from "../models/Room.js";
import { inngest } from "../inngest/index.js";

export const getNowPlayingMovies = async (req, res) => {
    try {
        const { data } = await axios.get('https://api.themoviedb.org/3/movie/now_playing', {
            headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` }
        });

        res.json({ success: true, movies: data.results });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Loi khi lay danh sach phim tu TMDB: " + error.message });
    }
};

export const addShow = async (req, res) => {
    try {
        const { movieId, roomId, showsInput, basePrice } = req.body;

        const roomExists = await Room.findById(roomId);
        if (!roomExists) {
            return res.json({ success: false, message: "Phong chieu khong ton tai trong he thong." });
        }

        if (roomExists.status && roomExists.status !== 'ACTIVE') {
            return res.json({
                success: false,
                message: "Phong chieu dang bao tri hoac ngung khai thac, khong the tao suat chieu."
            });
        }

        let movie = await Movie.findById(movieId);
        if (!movie) {
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
        }

        const showsToCreate = [];

        showsInput.forEach((show) => {
            const showDate = show.date;
            show.time.forEach((time) => {
                const dateTimeString = `${showDate}T${time}+07:00`;
                showsToCreate.push({
                    movie: movieId,
                    room: roomId,
                    showDateTime: new Date(dateTimeString),
                    basePrice,
                    occupiedSeats: {}
                });
            });
        });

        if (showsToCreate.length > 0) {
            await Show.insertMany(showsToCreate);
        }

        await inngest.send({
            name: "app/show.added",
            data: { movieTitle: movie.title }
        });

        res.json({ success: true, message: "Them suat chieu thanh cong." });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Loi khi them suat chieu: " + error.message });
    }
};

export const getShows = async (req, res) => {
    try {
        const shows = await Show.find({ showDateTime: { $gte: new Date() } })
            .populate('movie')
            .populate('room')
            .sort({ showDateTime: 1 });

        const uniqueMoviesMap = new Map();

        shows
            .filter((show) => show.room && (!show.room.status || show.room.status === 'ACTIVE'))
            .forEach((show) => {
                uniqueMoviesMap.set(show.movie._id.toString(), show.movie);
            });

        res.json({ success: true, shows: Array.from(uniqueMoviesMap.values()) });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Loi khi tai danh sach phim: " + error.message });
    }
};

export const getShow = async (req, res) => {
    try {
        const { movieId } = req.params;

        const shows = await Show.find({
            movie: movieId,
            showDateTime: { $gte: new Date() }
        }).populate('room');

        const movie = await Movie.findById(movieId);
        const dateTime = {};

        shows
            .filter((show) => show.room && (!show.room.status || show.room.status === 'ACTIVE'))
            .forEach((show) => {
                const date = new Date(show.showDateTime).toLocaleDateString('en-CA', {
                    timeZone: 'Asia/Ho_Chi_Minh'
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
        res.json({ success: false, message: "Loi khi tai chi tiet lich chieu: " + error.message });
    }
};

export const getSeatLayoutForShow = async (req, res) => {
    try {
        const { showId } = req.params;
        const show = await Show.findById(showId).populate('room');

        if (!show) {
            return res.json({ success: false, message: "Suat chieu khong ton tai." });
        }

        if (!show.room) {
            return res.json({ success: false, message: "Phong chieu khong ton tai." });
        }

        if (show.room.status && show.room.status !== 'ACTIVE') {
            return res.json({
                success: false,
                message: "Phong chieu dang bao tri hoac ngung khai thac."
            });
        }

        const occupiedSeatsArray = show.occupiedSeats ? Object.keys(show.occupiedSeats) : [];
        const heldSeatsArray = show.heldSeats ? Object.keys(show.heldSeats) : [];

        res.json({
            success: true,
            roomName: show.room.name,
            basePrice: show.basePrice,
            seatMap: show.room.seatMap,
            occupiedSeats: occupiedSeatsArray,
            heldSeats: heldSeatsArray
        });
    } catch (error) {
        res.json({ success: false, message: "Loi khi tai so do ghe: " + error.message });
    }
};
