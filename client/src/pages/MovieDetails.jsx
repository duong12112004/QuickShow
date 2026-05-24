import React, { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  BadgeCheckIcon,
  EyeIcon,
  Globe2Icon,
  Heart,
  LanguagesIcon,
  MessageSquareIcon,
  PlayCircleIcon,
  SendIcon,
  StarIcon,
  TicketIcon,
  UserRoundIcon
} from 'lucide-react'
import toast from 'react-hot-toast'
import BlurCircle from '../components/BlurCircle'
import DateSelect from '../components/DateSelect'
import Loading from '../components/Loading'
import MovieCard from '../components/MovieCard'
import TrailerModal from '../components/TrailerModal'
import { useAppContext } from '../context/AppContext'
import timeFormat from '../lib/timeFormat'
import {
  formatCertification,
  formatCountries,
  formatLanguages,
  getMovieGenres,
  getMovieOriginalTitle,
  getMovieOverview,
  getMovieTitle,
  getYoutubeEmbedUrl
} from '../lib/movieDisplay'

const MAX_COMMENT_LENGTH = 1500
const COMMENTS_PAGE_SIZE = 5

const MovieDetails = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const [show, setShow] = useState(null)
  const [trailerEmbedUrl, setTrailerEmbedUrl] = useState('')
  const [comments, setComments] = useState([])
  const [visibleCommentCount, setVisibleCommentCount] = useState(COMMENTS_PAGE_SIZE)
  const [visibleSpoilers, setVisibleSpoilers] = useState(new Set())
  const [commentForm, setCommentForm] = useState({
    comment: '',
    hasSpoiler: false
  })
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  const { shows, axios, getToken, user, fetchFavoriteMovies, favoriteMovies, image_base_url } = useAppContext()

  const formatVoteCount = (value) => Number(value || 0).toLocaleString('vi-VN')

  const formatCommentDate = (value) => {
    if (!value) return ''

    return new Date(value).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const fetchMovieComments = useCallback(async (movieId) => {
    try {
      const { data } = await axios.get(`/api/reviews/movie/${movieId}`)

      if (data.success) {
        setComments(data.reviews || [])
      }
    } catch (error) {
      console.error(error)
    }
  }, [axios])

  const handleFavorite = async () => {
    try {
      if (!user) {
        return toast.error('Vui lòng đăng nhập để thực hiện chức năng này!')
      }

      const { data } = await axios.post('/api/user/update-favorite',
        { movieId: id },
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      )

      if (data.success) {
        await fetchFavoriteMovies()
        toast.success(data.message)
      }
    } catch (error) {
      console.log(error)
    }
  }

  const handleTrailer = () => {
    const embedUrl = getYoutubeEmbedUrl(show?.movie)

    if (embedUrl) {
      setTrailerEmbedUrl(embedUrl)
      return
    }

    toast('Trailer của phim này sẽ được cập nhật sớm.')
  }

  const handleSubmitComment = async (event) => {
    event.preventDefault()

    if (!user) {
      toast.error('Vui lòng đăng nhập để bình luận.')
      return
    }

    if (!commentForm.comment.trim()) {
      toast.error('Vui lòng nhập bình luận.')
      return
    }

    try {
      setIsSubmittingComment(true)
      const { data } = await axios.post('/api/reviews', {
        movieId: id,
        comment: commentForm.comment,
        hasSpoiler: commentForm.hasSpoiler
      }, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      })

      if (data.success) {
        toast.success(data.message)
        setCommentForm({ comment: '', hasSpoiler: false })
        await fetchMovieComments(id)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error('Không thể gửi bình luận lúc này.')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const revealSpoiler = (commentId) => {
    setVisibleSpoilers((current) => {
      const next = new Set(current)
      next.add(commentId)
      return next
    })
  }

  const showMoreComments = () => {
    setVisibleCommentCount((current) => current + COMMENTS_PAGE_SIZE)
  }

  useEffect(() => {
    let isMounted = true

    const fetchShow = async () => {
      try {
        const { data } = await axios.get(`/api/show/${id}`)
        if (data.success && isMounted) {
          setShow(data)
        }
      } catch (error) {
        console.log(error)
      }
    }

    fetchShow()

    return () => {
      isMounted = false
    }
  }, [axios, id])

  useEffect(() => {
    setVisibleCommentCount(COMMENTS_PAGE_SIZE)
    setVisibleSpoilers(new Set())
    fetchMovieComments(id)
  }, [fetchMovieComments, id])

  useEffect(() => {
    if (!show || location.hash !== '#dateSelect') {
      return
    }

    const scrollTimer = setTimeout(() => {
      document.getElementById('dateSelect')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)

    return () => clearTimeout(scrollTimer)
  }, [show, location.hash])

  if (!show) {
    return <Loading />
  }

  const movie = show.movie
  const movieTitle = getMovieTitle(movie)
  const originalTitle = getMovieOriginalTitle(movie)
  const movieOverview = getMovieOverview(movie)
  const movieGenres = getMovieGenres(movie)
  const imdbRating = movie.imdb_rating ? movie.imdb_rating.toFixed(1) : ''
  const tmdbRating = movie.vote_average ? movie.vote_average.toFixed(1) : '0.0'
  const externalRatingLabel = imdbRating ? 'IMDb' : 'TMDB'
  const externalRating = imdbRating || tmdbRating
  const externalVoteLabel = imdbRating
    ? movie.imdb_votes ? ` (${movie.imdb_votes} lượt)` : ''
    : ` (${formatVoteCount(movie.vote_count)} lượt)`
  const countries = formatCountries(movie.production_countries)
  const languages = formatLanguages(movie.spoken_languages)
  const certification = formatCertification(movie)
  const visibleComments = comments.slice(0, visibleCommentCount)
  const hasMoreComments = visibleCommentCount < comments.length

  return (
    <div className='px-6 pt-30 md:px-16 md:pt-50 lg:px-40'>
      <div className='mx-auto flex max-w-6xl flex-col gap-8 md:flex-row'>
        <img src={image_base_url + movie.poster_path} alt={movieTitle} className='h-104 max-w-70 rounded-xl object-cover max-md:mx-auto' />

        <div className='relative flex flex-col gap-3'>
          <BlurCircle top='-100px' left='-100px' />

          <h1 className='max-w-96 text-balance text-4xl font-semibold'>{movieTitle}</h1>
          {originalTitle && (
            <p className='text-lg font-medium text-primary/90'>{originalTitle}</p>
          )}

          <div className='flex flex-wrap items-center gap-2 text-sm text-gray-300'>
            <span className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2'>
              <StarIcon className='h-4 w-4 fill-primary text-primary' />
              {externalRatingLabel} {externalRating}{externalVoteLabel}
            </span>
          </div>

          <p className='mt-2 max-w-xl text-sm leading-tight text-gray-400'>
            {movieOverview}
          </p>
          <p>
            {timeFormat(movie.runtime)} • {movieGenres.map((genre) => genre.name).join(', ')} • {movie.release_date.split('-')[0]}
          </p>

          <div className='grid max-w-2xl grid-cols-1 gap-3 pt-2 text-sm text-gray-300 sm:grid-cols-2'>
            <div className='inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3'>
              <UserRoundIcon className='h-4 w-4 text-primary' />
              Đạo diễn: {movie.director || 'Chưa cập nhật'}
            </div>
            <div className='inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3'>
              Phân loại: {certification}
              <BadgeCheckIcon className='h-4 w-4 text-primary' />
            </div>
            <div className='inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3'>
              <Globe2Icon className='h-4 w-4 text-primary' />
              Quốc gia: {countries}
            </div>
            <div className='inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3'>
              <LanguagesIcon className='h-4 w-4 text-primary' />
              Ngôn ngữ phim: {languages}
            </div>
          </div>

          <div className='mt-4 flex flex-wrap items-center gap-4'>
            <button onClick={handleTrailer} className='flex cursor-pointer items-center gap-2 rounded-md bg-gray-800 px-7 py-3 text-sm font-medium transition hover:bg-gray-900 active:scale-95'>
              <PlayCircleIcon className='h-5 w-5' />
              Xem Trailer
            </button>
            <a href='#dateSelect' className='inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-10 py-3 text-sm font-medium transition hover:bg-primary-dull active:scale-95'>
              <TicketIcon className='h-5 w-5' />
              Đặt vé ngay
            </a>
            <button onClick={handleFavorite} className='cursor-pointer rounded-full bg-gray-700 p-2.5 transition hover:bg-gray-600 active:scale-95'>
              <Heart className={`h-5 w-5 ${favoriteMovies.find((movie) => movie._id === id) ? 'fill-primary text-primary' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className='mt-16 grid gap-8 lg:grid-cols-[minmax(0,0.3fr)_minmax(0,0.7fr)]'>
        <section>
          <p className='text-lg font-medium'>Diễn viên nổi bật</p>
          <div className='no-scrollbar mt-6 overflow-x-auto pb-4 lg:overflow-visible'>
            <div className='flex w-max items-center gap-4 px-1 lg:w-full lg:flex-wrap'>
              {show.movie.casts.slice(0, 12).map((cast, index) => (
                <div key={index} className='w-20 shrink-0 text-center'>
                  <img src={cast.profile_path ? image_base_url + cast.profile_path : image_base_url + movie.poster_path} alt={cast.name} className='aspect-square h-16 rounded-full object-cover md:h-20' />
                  <p className='mt-3 text-xs font-medium'>{cast.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className='rounded-3xl border border-transparent bg-transparent p-0 md:p-0'>
          <div className='flex items-center gap-3'>
            <MessageSquareIcon className='h-6 w-6 text-white' />
            <h2 className='text-2xl font-semibold text-white'>Bình luận ({comments.length})</h2>
          </div>

          <form onSubmit={handleSubmitComment} className='mt-8'>
            <div className='mb-5 flex items-center gap-3'>
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt={user.fullName || 'User'} className='h-11 w-11 rounded-full object-cover' />
              ) : (
                <div className='flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary'>
                  {user?.firstName?.charAt(0) || 'Q'}
                </div>
              )}
              <div>
                <p className='text-xs text-gray-500'>Bình luận với tên</p>
                <p className='text-sm font-semibold text-white'>{user?.fullName || user?.firstName || 'Khách'}</p>
              </div>
            </div>

            <div className='overflow-hidden rounded-xl border border-white/8 bg-[#272a34] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'>
              <div className='relative'>
                <textarea
                  value={commentForm.comment}
                  onChange={(event) => setCommentForm((current) => ({ ...current, comment: event.target.value }))}
                  placeholder={user ? 'Viết bình luận...' : 'Đăng nhập để viết bình luận...'}
                  rows={4}
                  maxLength={MAX_COMMENT_LENGTH}
                  disabled={!user}
                  className='min-h-24 w-full resize-none rounded-lg bg-[#0a0a11] px-4 py-4 pr-20 text-sm text-white outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-70'
                />
                <span className='absolute right-4 top-3 text-xs text-gray-400'>
                  {commentForm.comment.length} / {MAX_COMMENT_LENGTH}
                </span>
              </div>

              <div className='flex items-center justify-between px-1 py-3'>
                <label className='inline-flex items-center gap-2 text-sm text-white'>
                  <input
                    type='checkbox'
                    checked={commentForm.hasSpoiler}
                    onChange={(event) => setCommentForm((current) => ({ ...current, hasSpoiler: event.target.checked }))}
                    disabled={!user}
                    className='h-4 w-4 accent-primary'
                  />
                  Tiết lộ
                </label>

                <button
                  type='submit'
                  disabled={!user || isSubmittingComment}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60 ${commentForm.hasSpoiler ? 'text-yellow-300' : 'text-primary'}`}
                >
                  {isSubmittingComment ? 'Đang gửi...' : 'Gửi'}
                  <SendIcon className={`h-5 w-5 ${commentForm.hasSpoiler ? 'fill-yellow-300 text-yellow-300' : 'fill-primary text-primary'}`} />
                </button>
              </div>
            </div>
          </form>

          <div className='mt-10 space-y-8'>
            {comments.length === 0 ? (
              <div className='rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-gray-400'>
                Chưa có bình luận nào cho phim này.
              </div>
            ) : visibleComments.map((comment) => {
              const isSpoilerHidden = comment.hasSpoiler && !visibleSpoilers.has(comment._id)

              return (
                <article key={comment._id} className='flex gap-3'>
                  {comment.userImage ? (
                    <img src={comment.userImage} alt={comment.userName} className='h-11 w-11 rounded-full object-cover' />
                  ) : (
                    <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary'>
                      {comment.userName?.charAt(0) || 'Q'}
                    </div>
                  )}

                  <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-3'>
                      <p className='font-semibold text-white'>{comment.userName}</p>
                      <span className='text-xs text-gray-500'>{formatCommentDate(comment.createdAt)}</span>
                      {comment.hasSpoiler && (
                        <span className='rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-xs text-amber-200'>
                          Spoiler
                        </span>
                      )}
                      {comment.rating && (
                        <span className='inline-flex items-center gap-1 rounded-full border border-yellow-300/20 bg-yellow-300/10 px-2 py-0.5 text-xs text-yellow-300'>
                          <StarIcon className='h-3 w-3 fill-yellow-300' />
                          {comment.rating}/10
                        </span>
                      )}
                    </div>

                    <div className='mt-2'>
                      <p className={`whitespace-pre-line text-sm leading-6 text-gray-300 transition ${isSpoilerHidden ? 'select-none blur-sm' : ''}`}>
                        {comment.comment}
                      </p>
                      {isSpoilerHidden && (
                        <button
                          type='button'
                          onClick={() => revealSpoiler(comment._id)}
                          className='mt-3 inline-flex h-8 items-center gap-2 rounded-full border border-yellow-300/20 bg-black/60 px-3 text-xs font-medium text-yellow-300 backdrop-blur transition hover:border-yellow-300/50'
                        >
                          <EyeIcon className='h-4 w-4 text-yellow-300' />
                          Xem bình luận
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}

            {hasMoreComments && (
              <div className='flex justify-start pt-1 pl-14'>
                <button
                  type='button'
                  onClick={showMoreComments}
                  className='text-sm font-medium text-primary transition hover:text-primary-dull'
                >
                  Xem thêm bình luận
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      <DateSelect dateTime={show.dateTime} id={id} />

      <p className='mb-8 mt-20 text-lg font-medium'>Có thể bạn sẽ thích</p>
      <div className='flex flex-wrap gap-8 max-sm:justify-center'>
        {shows.slice(0, 4).map((movie, index) => (
          <MovieCard key={index} movie={movie} />
        ))}
      </div>

      <div className='mt-20 flex justify-center'>
        <button onClick={() => { navigate('/movies'); scrollTo(0, 0) }} className='cursor-pointer rounded-md bg-primary px-10 py-3 text-sm font-medium transition hover:bg-primary-dull'>
          Xem thêm
        </button>
      </div>

      <TrailerModal
        embedUrl={trailerEmbedUrl}
        title={`Trailer ${movieTitle}`}
        onClose={() => setTrailerEmbedUrl('')}
      />
    </div>
  )
}

export default MovieDetails
