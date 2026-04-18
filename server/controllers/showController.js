import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import Room from "../models/Room.js";
import { inngest } from "../inngest/index.js";

// Lấy danh sách phim đang chiếu từ API của TMDB
export const getNowPlayingMovies = async (req, res) => {
    try {
        const { data } = await axios.get('https://api.themoviedb.org/3/movie/now_playing', {
            headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` }
        });
        res.json({ success: true, movies: data.results });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi lấy danh sách phim từ TMDB: " + error.message });
    }
};

// Thêm suất chiếu mới vào hệ thống
export const addShow = async (req, res) => {
    try {
        const { movieId, roomId, showsInput, basePrice } = req.body;

        // Kiểm tra tính hợp lệ của phòng chiếu
        const roomExists = await Room.findById(roomId);
        if (!roomExists) {
            return res.json({ success: false, message: "Phòng chiếu không tồn tại trong hệ thống!" });
        }

        // Kiểm tra và đồng bộ dữ liệu phim từ TMDB nếu chưa có trong Database
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
                    basePrice: basePrice,
                    occupiedSeats: {}
                });
            });
        });

        if (showsToCreate.length > 0) {
            await Show.insertMany(showsToCreate);
        }

        // Gửi event để xử lý các background job (nếu có) khi có suất chiếu mới
        await inngest.send({
            name: "app/show.added",
            data: { movieTitle: movie.title }
        });

        res.json({ success: true, message: "Thêm suất chiếu thành công!" });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi thêm suất chiếu: " + error.message });
    }
};

// Lấy danh sách các bộ phim có suất chiếu sắp tới (hiển thị trên trang chủ)
export const getShows = async (req, res) => {
    try {
        const shows = await Show.find({ showDateTime: { $gte: new Date() } })
            .populate('movie')
            .sort({ showDateTime: 1 });

        // Lọc để lấy danh sách các phim duy nhất từ các suất chiếu
        const uniqueMoviesMap = new Map();
        shows.forEach(show => {
            uniqueMoviesMap.set(show.movie._id.toString(), show.movie);
        });

        res.json({ success: true, shows: Array.from(uniqueMoviesMap.values()) });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tải danh sách phim: " + error.message });
    }
};

// Lấy thông tin chi tiết và lịch chiếu của một bộ phim cụ thể
export const getShow = async (req, res) => {
    try {
        const { movieId } = req.params;

        const shows = await Show.find({
            movie: movieId,
            showDateTime: { $gte: new Date() }
        }).populate('room');

        const movie = await Movie.findById(movieId);
        const dateTime = {};

        shows.forEach((show) => {
            // Định dạng ngày theo chuẩn múi giờ Việt Nam (UTC+7)
            const date = new Date(show.showDateTime).toLocaleDateString('en-CA', {
                timeZone: 'Asia/Ho_Chi_Minh'
            });

            if (!dateTime[date]) {
                dateTime[date] = [];
            }
            dateTime[date].push({
                time: show.showDateTime,
                showId: show._id,
                roomName: show.room?.name || "N/A"
            });
        });

        res.json({ success: true, movie, dateTime });
    } catch (error) {
        res.json({ success: false, message: "Lỗi khi tải chi tiết lịch chiếu: " + error.message });
    }
};

// Lấy sơ đồ ghế và trạng thái ghế (đã đặt/đang giữ) cho màn hình đặt vé
export const getSeatLayoutForShow = async (req, res) => {
    try {
        const { showId } = req.params;

        const show = await Show.findById(showId).populate('room');

        if (!show) return res.json({ success: false, message: "Suất chiếu không tồn tại!" });
        if (!show.room) return res.json({ success: false, message: "Phòng chiếu không tồn tại!" });

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
        res.json({ success: false, message: "Lỗi khi tải sơ đồ ghế: " + error.message });
    }
};