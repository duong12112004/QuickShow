import express from 'express'   
import {getNowPlayingMovies, addShow, getLatestAddedShowMovie, getShow, getShows, getShowSchedule, getSeatLayoutForShow} from '../controllers/showController.js'
import { protectAdmin } from '../middleware/auth.js'

const showRouter = express.Router()

// Lấy phim đang chiếu từ TMDB để phục vụ chọn phim khi tạo suất.
showRouter.get('/now-playing',getNowPlayingMovies)
// Tạo suất chiếu theo luồng cũ; chỉ admin được phép gọi.
showRouter.post('/add', protectAdmin, addShow)
// Các endpoint công khai để khách xem phim, lịch chiếu và sơ đồ ghế.
showRouter.get('/all',getShows)
showRouter.get('/latest-added', getLatestAddedShowMovie)
showRouter.get('/schedule', getShowSchedule)
showRouter.get('/:movieId',getShow)
showRouter.get('/:showId/seat-layout', getSeatLayoutForShow)
export default showRouter
