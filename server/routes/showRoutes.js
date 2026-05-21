import express from 'express'   
import {getNowPlayingMovies, addShow, getShow, getShows, getShowSchedule, getSeatLayoutForShow} from '../controllers/showController.js'
import { protectAdmin } from '../middleware/auth.js'

const showRouter = express.Router()

showRouter.get('/now-playing',getNowPlayingMovies)
showRouter.post('/add', protectAdmin, addShow)
showRouter.get('/all',getShows)
showRouter.get('/schedule', getShowSchedule)
showRouter.get('/:movieId',getShow)
showRouter.get('/:showId/seat-layout', getSeatLayoutForShow)
export default showRouter
