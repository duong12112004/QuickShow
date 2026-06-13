import React, { useEffect, useState } from 'react'
import { ArrowRight, CalendarIcon, ClockIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import timeFormat from '../lib/timeFormat'
import { getMovieGenres, getMovieOverview, getMovieTitle } from '../lib/movieDisplay'
import Loading from './Loading'

// Component hiển thị Banner chính (Hero) trên trang chủ
const HeroSection = () => {
    const { axios, image_base_url } = useAppContext()
    const [heroMovie, setHeroMovie] = useState(null)
    const [isHeroLoading, setIsHeroLoading] = useState(true)

    const navigate = useNavigate()

    useEffect(() => {
      let isMounted = true

      const fetchLatestAddedMovie = async () => {
        try {
          const { data } = await axios.get('/api/show/latest-added')

          if (isMounted && data.success) {
            setHeroMovie(data.movie || null)
          }
        } catch (error) {
          console.error(error)
        } finally {
          if (isMounted) {
            setIsHeroLoading(false)
          }
        }
      }

      fetchLatestAddedMovie()

      return () => {
        isMounted = false
      }
    }, [axios])

    const movieTitle = isHeroLoading
      ? 'Đang tải phim mới nhất'
      : heroMovie
        ? getMovieTitle(heroMovie)
        : 'Phim đang chiếu tại QuickShow'
    const movieOverview = isHeroLoading
      ? 'QuickShow đang lấy phim được admin thêm gần nhất...'
      : heroMovie
      ? getMovieOverview(heroMovie)
      : 'QuickShow đang cập nhật các suất chiếu mới nhất. Hãy khám phá danh sách phim để chọn suất chiếu phù hợp.'
    const genres = heroMovie
      ? getMovieGenres(heroMovie).slice(0, 3).map((genre) => genre?.name || genre).filter(Boolean)
      : []
    const releaseYear = heroMovie?.release_date ? new Date(heroMovie.release_date).getFullYear() : ''
    const runtime = heroMovie?.runtime ? timeFormat(heroMovie.runtime) : ''
    const backdropPath = heroMovie?.backdrop_path || heroMovie?.poster_path
    const backgroundImage = backdropPath ? image_base_url + backdropPath : ''
    const heroBackgroundImage = backgroundImage
      ? `linear-gradient(90deg, rgba(5,8,15,0.95) 0%, rgba(5,8,15,0.72) 45%, rgba(5,8,15,0.35) 100%), url("${backgroundImage}")`
      : 'linear-gradient(90deg, rgba(5,8,15,1) 0%, rgba(8,12,24,0.96) 55%, rgba(16,24,45,0.92) 100%)'

    const handleExplore = () => {
      navigate(heroMovie?._id ? `/movies/${heroMovie._id}` : '/movies')
      scrollTo(0, 0)
    }

    if (isHeroLoading) {
      return (
        <div className='flex h-screen items-center justify-center'>
          <Loading />
        </div>
      )
    }

  return (
    <div
      className='relative flex h-screen flex-col items-start justify-center gap-4 overflow-hidden bg-cover bg-center px-6 md:px-16 lg:px-36'
      style={{
        backgroundImage: heroBackgroundImage
      }}
    >
      <div className='mt-20 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-sm font-medium text-primary'>
        {isHeroLoading ? 'Đang đồng bộ' : 'Phim mới được thêm'}
      </div>

      <h1 className='max-w-3xl text-5xl font-semibold md:text-[70px] md:leading-18'>{movieTitle}</h1>

      <div className='flex flex-wrap items-center gap-4 text-gray-300'>
        {genres.length > 0 && <span>{genres.join(' | ')}</span>}
        {releaseYear && (
          <div className='flex items-center gap-1'>
              <CalendarIcon className='w-4.5 h-4.5'/> {releaseYear}
          </div>
        )}
        {runtime && (
          <div className='flex items-center gap-1'>
              <ClockIcon className='w-4.5 h-4.5'/> {runtime}
          </div>
        )}
      </div>
      
      <p className='line-clamp-4 max-w-xl text-gray-300'>
        {movieOverview}
      </p>
      
      <button onClick={handleExplore} className='flex cursor-pointer items-center gap-1 rounded-full bg-primary px-6 py-3 text-sm font-medium transition hover:bg-primary-dull'>
        {heroMovie ? 'Xem chi tiết' : 'Khám phá ngay'}
        <ArrowRight className='w-5 h-5'/>
      </button>
    </div>
  )
}

export default HeroSection
