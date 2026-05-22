import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BlurCircle from '../components/BlurCircle'
import {
  BadgeCheckIcon,
  Globe2Icon,
  Heart,
  LanguagesIcon,
  PlayCircleIcon,
  StarIcon,
  TicketIcon,
  UserRoundIcon
} from 'lucide-react'
import timeFormat from '../lib/timeFormat'
import DateSelect from '../components/DateSelect'
import MovieCard from '../components/MovieCard'
import Loading from '../components/Loading'
import { useAppContext } from '../context/AppContext'
import toast from 'react-hot-toast'
import TrailerModal from '../components/TrailerModal'
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

// Component hiển thị trang Chi tiết của một bộ phim
const MovieDetails = () => {

  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const [show, setShow] = useState(null)
  const [trailerEmbedUrl, setTrailerEmbedUrl] = useState('')

  const { shows, axios, getToken, user, fetchFavoriteMovies, favoriteMovies, image_base_url } = useAppContext()

  const formatVoteCount = (value) => {
    return Number(value || 0).toLocaleString('vi-VN')
  }

  // Xử lý thêm/xóa phim khỏi danh sách yêu thích
  const handleFavorite = async () => {
    try {
      if (!user) {
        return toast.error("Vui lòng đăng nhập để thực hiện chức năng này!");
      }

      const { data } = await axios.post('/api/user/update-favorite',
        { movieId: id },
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      );

      if (data.success) {
        await fetchFavoriteMovies();
        toast.success(data.message); // Lấy message tiếng Việt trực tiếp từ Backend trả về
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
  const countries = formatCountries(movie.production_countries)
  const languages = formatLanguages(movie.spoken_languages)
  const certification = formatCertification(movie)

  return (
    <div className='px-6 md:px-16 lg:px-40 pt-30 md:pt-50'>
      <div className='flex flex-col md:flex-row gap-8 max-w-6xl mx-auto'>
        <img src={image_base_url + movie.poster_path} alt={movieTitle} className='max-md:mx-auto rounded-xl h-104 max-w-70 object-cover' />
        
        <div className='relative flex flex-col gap-3'>
          <BlurCircle top='-100px' left='-100px' />
          
          <h1 className='text-4xl font-semibold max-w-96 text-balance'>{movieTitle}</h1>
          {originalTitle && (
            <p className='text-lg font-medium text-primary/90'>{originalTitle}</p>
          )}
          
          <div className='flex flex-wrap items-center gap-2 text-sm text-gray-300'>
            {imdbRating && (
              <span className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2'>
                <StarIcon className='w-4 h-4 text-primary fill-primary' />
                IMDb {imdbRating}{movie.imdb_votes ? ` (${movie.imdb_votes} lượt)` : ''}
              </span>
            )}
            <span className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2'>
              <StarIcon className='w-4 h-4 text-primary fill-primary' />
              TMDB {tmdbRating} ({formatVoteCount(movie.vote_count)} lượt)
            </span>
          </div>
          
          <p className='text-gray-400 mt-2 text-sm leading-tight max-w-xl'>
            {movieOverview}
          </p>
          <p>
            {timeFormat(movie.runtime)} • {movieGenres.map(genre => genre.name).join(", ")} • {movie.release_date.split("-")[0]}
          </p>

          <div className='grid max-w-2xl grid-cols-1 gap-3 pt-2 text-sm text-gray-300 sm:grid-cols-2'>
            <div className='inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3'>
              <UserRoundIcon className='h-4 w-4 text-primary' />
              Đạo diễn: {movie.director || 'Chưa cập nhật'}
            </div>
            <div className='inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3'>
              <BadgeCheckIcon className='h-4 w-4 text-primary' />
              Phân loại: {certification}
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
          
          <div className='flex items-center flex-wrap gap-4 mt-4'>
            <button onClick={handleTrailer} className='flex items-center gap-2 px-7 py-3 text-sm bg-gray-800 hover:bg-gray-900 transition rounded-md font-medium cursor-pointer active:scale-95'>
              <PlayCircleIcon className='w-5 h-5' />
              Xem Trailer
            </button>
            <a href="#dateSelect" className='inline-flex items-center gap-2 px-10 py-3 text-sm bg-primary hover:bg-primary-dull transition rounded-md font-medium cursor-pointer active:scale-95'>
              <TicketIcon className='w-5 h-5' />
              Đặt vé ngay
            </a>
            <button onClick={handleFavorite} className='bg-gray-700 p-2.5 rounded-full transition cursor-pointer active:scale-95 hover:bg-gray-600'>
              <Heart className={`w-5 h-5 ${favoriteMovies.find(movie => movie._id === id) ? 'fill-primary text-primary' : ''}`} />
            </button>
          </div>
        </div>
      </div>
      
      <p className='text-lg font-medium mt-20'>Diễn viên nổi bật</p>
      <div className='overflow-x-auto no-scrollbar mt-8 pb-4'>
        <div className='flex items-center gap-4 w-max px-4'>
          {show.movie.casts.slice(0, 12).map((cast, index) => (
            <div key={index} className='flex flex-col items-center text-center'>
              <img src={cast.profile_path ? image_base_url + cast.profile_path : image_base_url + movie.poster_path} alt={cast.name} className='rounded-full h-20 md:h-20 aspect-square object-cover' />
              <p className='font-medium text-xs mt-3'>{cast.name}</p>
            </div>
          ))}
        </div>
      </div>

      <DateSelect dateTime={show.dateTime} id={id} />

      <p className='text-lg font-medium mt-20 mb-8'>Có thể bạn sẽ thích</p>
      <div className='flex flex-wrap max-sm:justify-center gap-8'>
        {shows.slice(0, 4).map((movie, index) => (
          <MovieCard key={index} movie={movie} />
        ))}
      </div>
      
      <div className='flex justify-center mt-20'>
        <button onClick={() => { navigate('/movies'); scrollTo(0, 0) }} className='px-10 py-3 text-sm bg-primary hover:bg-primary-dull transition rounded-md font-medium cursor-pointer'>
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
