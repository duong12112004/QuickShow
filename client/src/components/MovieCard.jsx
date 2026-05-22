import {
  CalendarDaysIcon,
  Clock3Icon,
  HeartIcon,
  InfoIcon,
  PlayCircleIcon,
  StarIcon,
  TicketIcon
} from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import timeFormat from '../lib/timeFormat'
import { useAppContext } from '../context/AppContext'
import TrailerModal from './TrailerModal'
import {
  formatCertification,
  getMovieGenres,
  getMovieOverview,
  getMovieTagline,
  getMovieTitle,
  getYoutubeEmbedUrl
} from '../lib/movieDisplay'

const PREVIEW_DELAY_MS = 1000
const PREVIEW_WIDTH = 520
const PREVIEW_GAP = 18
const PREVIEW_HEIGHT = 560

const địnhDạngNgàyKhởiChiếu = (ngày) => {
  if (!ngày) {
    return 'Chưa cập nhật'
  }

  return new Date(ngày).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Component thẻ phim nhỏ, có preview lớn sau khi người dùng hover đủ 1 giây.
const MovieCard = ({ movie }) => {
  const navigate = useNavigate()
  const {
    axios,
    favoriteMovies,
    fetchFavoriteMovies,
    getToken,
    image_base_url,
    shows,
    user
  } = useAppContext()
  const cardRef = useRef(null)
  const hoverTimerRef = useRef(null)
  const closeTimerRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [trailerEmbedUrl, setTrailerEmbedUrl] = useState('')

  const isFavorite = favoriteMovies.some((favoriteMovie) => favoriteMovie._id === movie._id)
  const hasShowtime = shows.some((showMovie) => showMovie._id === movie._id)
  const posterImage = movie.poster_path ? image_base_url + movie.poster_path : image_base_url + movie.backdrop_path
  const backdropImage = movie.backdrop_path ? image_base_url + movie.backdrop_path : posterImage
  const movieTitle = getMovieTitle(movie)
  const movieTagline = getMovieTagline(movie)
  const movieOverview = getMovieOverview(movie)
  const genres = getMovieGenres(movie).slice(0, 3)
  const imdbRating = movie.imdb_rating ? movie.imdb_rating.toFixed(1) : ''
  const tmdbRating = movie.vote_average ? movie.vote_average.toFixed(1) : '0.0'
  const displayRating = imdbRating || tmdbRating
  const ratingLabel = imdbRating ? 'IMDb' : 'TMDB'

  const goToDetail = () => {
    navigate(`/movies/${movie._id}`)
    scrollTo(0, 0)
  }

  const goToBooking = () => {
    navigate(`/movies/${movie._id}#dateSelect`)
  }

  const goToSchedule = () => {
    navigate('/schedule')
    scrollTo(0, 0)
  }

  const handleTrailer = () => {
    const embedUrl = getYoutubeEmbedUrl(movie)

    if (embedUrl) {
      setTrailerEmbedUrl(embedUrl)
      return
    }

    toast('Trailer của phim này sẽ được cập nhật sớm.')
  }

  const handlePrimaryAction = () => {
    if (hasShowtime) {
      goToBooking()
      return
    }

    goToSchedule()
  }

  const handleFavorite = async (event) => {
    event.stopPropagation()

    if (!user) {
      toast.error('Vui lòng đăng nhập để thêm phim yêu thích!')
      return
    }

    try {
      const { data } = await axios.post(
        '/api/user/update-favorite',
        { movieId: movie._id },
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      )

      if (data.success) {
        await fetchFavoriteMovies()
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error('Không thể cập nhật phim yêu thích lúc này.')
    }
  }

  const clearHoverTimers = () => {
    clearTimeout(hoverTimerRef.current)
    clearTimeout(closeTimerRef.current)
  }

  const openPreview = () => {
    if (!cardRef.current || window.innerWidth < 768) {
      return
    }

    const cardRect = cardRef.current.getBoundingClientRect()
    const nextLeft = Math.min(
      Math.max(cardRect.left + cardRect.width / 2 - PREVIEW_WIDTH / 2, PREVIEW_GAP),
      window.innerWidth - PREVIEW_WIDTH - PREVIEW_GAP
    )
    const preferredTop = cardRect.top + 24
    const maxTop = window.innerHeight - PREVIEW_HEIGHT - PREVIEW_GAP

    setPreview({
      left: nextLeft,
      top: Math.max(PREVIEW_GAP, Math.min(preferredTop, maxTop))
    })
  }

  const handleMouseEnter = () => {
    clearHoverTimers()
    hoverTimerRef.current = setTimeout(openPreview, PREVIEW_DELAY_MS)
  }

  const handleMouseLeave = () => {
    clearTimeout(hoverTimerRef.current)
    closeTimerRef.current = setTimeout(() => setPreview(null), 120)
  }

  useEffect(() => {
    return () => clearHoverTimers()
  }, [])

  return (
    <>
      <div
        ref={cardRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className='group relative flex w-66 flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_24px_70px_rgba(248,69,101,0.16)]'
      >
        <button
          type='button'
          onClick={goToDetail}
          className='relative block overflow-hidden rounded-2xl text-left'
        >
          <img
            src={posterImage}
            alt={movieTitle}
            className='h-72 w-full object-cover transition duration-500 group-hover:scale-105'
          />
          <div className='absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 to-transparent' />
          <div className='absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur'>
            {hasShowtime ? 'Đang chiếu' : 'Chờ lịch'}
          </div>
          <div className='absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur'>
            <StarIcon className='h-3.5 w-3.5 fill-primary text-primary' />
            {displayRating}
          </div>
        </button>

        <div className='flex flex-1 flex-col pt-4'>
          <div className='flex items-start justify-between gap-3'>
            <button
              type='button'
              onClick={goToDetail}
              className='min-w-0 text-left'
              title={movieTitle}
            >
              <p className='truncate text-base font-semibold text-white'>{movieTitle}</p>
              <p className='mt-1 truncate text-xs text-primary/90'>{movieTagline}</p>
            </button>

            <button
              type='button'
              onClick={handleFavorite}
              className='shrink-0 rounded-full border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:border-primary/40 hover:text-primary'
              title={isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
            >
              <HeartIcon className={`h-4 w-4 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
            </button>
          </div>

          <div className='mt-3 flex flex-wrap gap-2 text-[11px] text-gray-300'>
            <span className='rounded-full border border-white/10 bg-white/5 px-2.5 py-1'>
              {new Date(movie.release_date).getFullYear()}
            </span>
            <span className='rounded-full border border-white/10 bg-white/5 px-2.5 py-1'>
              {timeFormat(movie.runtime)}
            </span>
          </div>

          <div className='mt-4 flex items-center gap-2'>
            <button
              type='button'
              onClick={handlePrimaryAction}
              className='inline-flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dull'
            >
              <TicketIcon className='h-4 w-4' />
              {hasShowtime ? 'Đặt vé' : 'Xem lịch'}
            </button>
            <button
              type='button'
              onClick={goToDetail}
              className='inline-flex items-center justify-center rounded-full border border-white/15 px-3 py-2.5 text-sm font-medium text-gray-200 transition hover:border-primary/40 hover:text-white'
              aria-label={`Xem chi tiết phim ${movieTitle}`}
            >
              <InfoIcon className='h-4 w-4' />
            </button>
          </div>
        </div>
      </div>

      {preview && createPortal(
        <div
          onMouseEnter={clearHoverTimers}
          onMouseLeave={handleMouseLeave}
          className='fixed z-[80] hidden w-[520px] overflow-hidden rounded-[1.75rem] border border-white/12 bg-[#161824] text-white shadow-[0_32px_90px_rgba(0,0,0,0.55)] md:block'
          style={{ left: preview.left, top: preview.top }}
        >
          <div className='relative h-72 overflow-hidden'>
            <img
              src={backdropImage}
              alt={movieTitle}
              className='h-full w-full object-cover'
            />
            <div className='absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(22,24,36,0.9))]' />
            <button
              type='button'
              onClick={handleTrailer}
              className='absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-black/75'
            >
              <PlayCircleIcon className='h-5 w-5 text-primary' />
              Xem trailer
            </button>
            <div className='absolute bottom-5 left-5 right-5'>
              <div className='mb-3 inline-flex rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary'>
                {hasShowtime ? 'Đang mở bán vé' : 'Chưa có suất chiếu'}
              </div>
              <h3 className='text-2xl font-semibold leading-tight'>{movieTitle}</h3>
              {movieTagline && <p className='mt-1 text-sm text-primary/90'>{movieTagline}</p>}
            </div>
          </div>

          <div className='p-5'>
            <div className='flex flex-wrap gap-2 text-xs text-gray-300'>
              <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2'>
                <StarIcon className='h-4 w-4 fill-primary text-primary' />
                {ratingLabel} {displayRating}
              </span>
              <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2'>
                <Clock3Icon className='h-4 w-4 text-primary' />
                {timeFormat(movie.runtime)}
              </span>
              <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2'>
                <CalendarDaysIcon className='h-4 w-4 text-primary' />
                {địnhDạngNgàyKhởiChiếu(movie.release_date)}
              </span>
              {movie.certification && (
                <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2'>
                  {formatCertification(movie)}
                </span>
              )}
            </div>

            <p className='movie-card-overview mt-4 text-sm leading-6 text-gray-300'>
              {movieOverview || 'QuickShow đang cập nhật mô tả cho bộ phim này.'}
            </p>

            <div className='mt-4 flex flex-wrap gap-2 text-xs font-medium text-gray-200'>
              {genres.map((genre) => (
                <span key={genre.id || genre.name} className='rounded-full border border-white/10 bg-white/5 px-3 py-2'>
                  {genre.name}
                </span>
              ))}
            </div>

            <div className='mt-5 grid grid-cols-3 gap-3'>
              <button
                type='button'
                onClick={handlePrimaryAction}
                className='inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold transition hover:bg-primary-dull'
              >
                <TicketIcon className='h-4 w-4' />
                {hasShowtime ? 'Đặt vé' : 'Xem lịch'}
              </button>
              <button
                type='button'
                onClick={handleFavorite}
                className='inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-medium text-gray-200 transition hover:border-primary/40 hover:text-white'
              >
                <HeartIcon className={`h-4 w-4 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
                Yêu thích
              </button>
              <button
                type='button'
                onClick={goToDetail}
                className='inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-medium text-gray-200 transition hover:border-primary/40 hover:text-white'
              >
                <InfoIcon className='h-4 w-4' />
                Chi tiết
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <TrailerModal
        embedUrl={trailerEmbedUrl}
        title={`Trailer ${movieTitle}`}
        onClose={() => setTrailerEmbedUrl('')}
      />
    </>
  )
}

export default MovieCard
