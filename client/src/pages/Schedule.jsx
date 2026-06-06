import React, { useEffect, useMemo, useState } from 'react'
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  MapPinIcon,
  MoveRightIcon,
  StarIcon,
  TicketIcon
} from 'lucide-react'
import toast from 'react-hot-toast'
import BlurCircle from '../components/BlurCircle'
import Loading from '../components/Loading'
import isoTimeFormat from '../lib/isoTimeFormat'
import timeFormat from '../lib/timeFormat'
import { getMovieGenres, getMovieTitle } from '../lib/movieDisplay'
import { useAppContext } from '../context/AppContext'

const TOTAL_SCHEDULE_DAYS = 15

const buildDateKey = (date) => {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
}

const buildNextScheduleDays = () => {
  const today = new Date()

  return Array.from({ length: TOTAL_SCHEDULE_DAYS }, (_, index) => {
    const nextDate = new Date(today)
    nextDate.setDate(today.getDate() + index)
    return buildDateKey(nextDate)
  })
}

const formatScheduleDate = (date) => {
  const parsedDate = new Date(`${date}T00:00:00`)

  return {
    weekday: parsedDate.toLocaleDateString('vi-VN', { weekday: 'short' }),
    weekdayLong: parsedDate.toLocaleDateString('vi-VN', { weekday: 'long' }),
    fullLabel: parsedDate.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }),
    day: parsedDate.toLocaleDateString('vi-VN', { day: '2-digit' }),
    month: parsedDate.toLocaleDateString('vi-VN', { month: '2-digit' })
  }
}

const Schedule = () => {
  const { axios, image_base_url, navigate } = useAppContext()
  const currency = import.meta.env.VITE_CURRENCY
  const calendarDays = useMemo(() => buildNextScheduleDays(), [])

  const [schedule, setSchedule] = useState([])
  const [selectedDate, setSelectedDate] = useState(calendarDays[0] || '')
  const [visibleDateStart, setVisibleDateStart] = useState(0)
  const [visibleDateCount, setVisibleDateCount] = useState(7)
  const [isLoading, setIsLoading] = useState(true)

  const scheduleByDate = useMemo(
    () => new Map(schedule.map((item) => [item.date, item.movies || []])),
    [schedule]
  )

  const maxVisibleStart = Math.max(calendarDays.length - visibleDateCount, 0)
  const activeDayMovies = scheduleByDate.get(selectedDate) || []

  const fetchSchedule = async () => {
    try {
      const { data } = await axios.get('/api/show/schedule')

      if (data.success) {
        setSchedule(data.schedule || [])
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error('Không thể tải lịch chiếu lúc này.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedule()
  }, [])

  useEffect(() => {
    const updateVisibleCount = () => {
      if (window.innerWidth < 640) {
        setVisibleDateCount(4)
        return
      }

      if (window.innerWidth < 1024) {
        setVisibleDateCount(5)
        return
      }

      setVisibleDateCount(7)
    }

    updateVisibleCount()
    window.addEventListener('resize', updateVisibleCount)

    return () => window.removeEventListener('resize', updateVisibleCount)
  }, [])

  useEffect(() => {
    setVisibleDateStart((currentStart) => Math.min(currentStart, Math.max(calendarDays.length - visibleDateCount, 0)))
  }, [calendarDays.length, visibleDateCount])

  if (isLoading) {
    return <Loading />
  }

  return (
    <div className='relative min-h-screen overflow-hidden px-4 pb-20 pt-28 sm:px-6 md:px-12 md:pt-36 lg:px-28 xl:px-36'>
      <BlurCircle top='140px' left='-60px' />
      <BlurCircle top='420px' right='-80px' />

      <div className='mx-auto max-w-7xl'>
        <div className='relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(248,69,101,0.14),rgba(9,9,11,0.96)_55%,rgba(255,255,255,0.04))] px-5 py-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:px-6 md:px-10 md:py-8'>
          <div className='flex flex-col gap-4 lg:max-w-3xl'>
            <div className='inline-flex w-max items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.25em] text-primary'>
              <CalendarDaysIcon className='h-4 w-4' />
              Lịch chiếu tại rạp
            </div>
            <h1 className='max-w-3xl text-3xl font-semibold leading-tight text-white md:text-4xl'>
              Lịch chiếu
            </h1>
          </div>
        </div>

        <div className='mt-8 flex items-center gap-2 sm:gap-3'>
          {visibleDateStart > 0 && (
            <button
              type='button'
              onClick={() => setVisibleDateStart((currentStart) => Math.max(currentStart - 1, 0))}
              className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition hover:border-primary/40 hover:text-white sm:h-12 sm:w-12'
            >
              <ChevronLeftIcon className='h-5 w-5 sm:h-6 sm:w-6' />
            </button>
          )}

          <div
            className='schedule-date-viewport flex-1 overflow-hidden'
            style={{ '--visible-count': `${visibleDateCount}`, '--schedule-offset': `${visibleDateStart}` }}
          >
            <div className='schedule-date-track'>
              {calendarDays.map((date) => {
                const dateInfo = formatScheduleDate(date)
                const isActive = date === selectedDate

                return (
                  <button
                    key={date}
                    type='button'
                    onClick={() => setSelectedDate(date)}
                    className={`schedule-date-item relative min-w-0 rounded-2xl border px-2 pb-3 pt-4 text-left transition-colors duration-200 sm:px-4 ${
                      isActive
                        ? 'border-primary/30 bg-white/3 text-primary'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:border-primary/20 hover:bg-primary/6 hover:text-white'
                    }`}
                  >
                    <span
                      className={`absolute top-0 h-0.5 rounded-full transition-all duration-200 ${
                        isActive ? 'left-3 right-3 bg-primary opacity-100 sm:left-4 sm:right-4' : 'left-3 right-3 bg-transparent opacity-0 sm:left-4 sm:right-4'
                      }`}
                    />
                    <p className={`truncate text-xs font-semibold uppercase tracking-[0.18em] sm:text-sm ${isActive ? 'text-primary' : 'text-gray-200'}`}>
                      {dateInfo.weekdayLong}
                    </p>
                    <p className={`mt-1 text-[11px] sm:text-xs ${isActive ? 'text-primary/80' : 'text-gray-400'}`}>
                      {dateInfo.day}/{dateInfo.month}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {visibleDateStart < maxVisibleStart && (
            <button
              type='button'
              onClick={() => setVisibleDateStart((currentStart) => Math.min(currentStart + 1, maxVisibleStart))}
              className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition hover:border-primary/40 hover:text-white sm:h-12 sm:w-12'
            >
              <ChevronRightIcon className='h-5 w-5 sm:h-6 sm:w-6' />
            </button>
          )}
        </div>

        <div className='mt-4 text-sm text-gray-400'>
          {formatScheduleDate(selectedDate).fullLabel}
        </div>

        <div className='mt-8 space-y-6'>
          {!activeDayMovies.length && (
            <div className='rounded-[2rem] border border-dashed border-white/10 bg-white/4 p-8 text-center text-sm text-gray-400'>
              Ngày này hiện chưa có suất chiếu.
            </div>
          )}

          {activeDayMovies.map(({ movie, showtimes, minPrice }) => {
            const movieTitle = getMovieTitle(movie)
            const movieGenres = getMovieGenres(movie)

            return (
              <div
                key={movie._id}
                className='rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-5 lg:p-6'
              >
              <div className='grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6'>
                <div className='flex h-full items-center justify-center'>
                  <div className='w-full overflow-hidden rounded-[1.25rem] border border-white/10'>
                    <img
                      src={image_base_url + movie.poster_path}
                      alt={movieTitle}
                      className='block aspect-[3/4] w-full object-cover'
                    />
                  </div>
                </div>

                <div className='flex flex-col gap-4 sm:gap-5'>
                  <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                    <div>
                      <p className='text-lg font-semibold text-white sm:text-2xl lg:text-3xl'>{movieTitle}</p>
                    </div>

                    <button
                      type='button'
                      onClick={() => {
                        navigate(`/movies/${movie._id}`)
                        scrollTo(0, 0)
                      }}
                      className='inline-flex items-center gap-2 self-start rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition hover:bg-primary/15 sm:px-4 sm:text-sm'
                    >
                      Xem chi tiết
                      <MoveRightIcon className='h-4 w-4' />
                    </button>
                  </div>

                  <div className='flex flex-wrap gap-2 text-xs text-gray-300 sm:gap-3 sm:text-sm'>
                    <div className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2'>
                      <Clock3Icon className='h-4 w-4 text-primary' />
                      {timeFormat(movie.runtime)}
                    </div>
                    <div className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2'>
                      <StarIcon className='h-4 w-4 fill-primary text-primary' />
                      {movie.vote_average ? movie.vote_average.toFixed(1) : '0.0'}
                    </div>
                    <div className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2'>
                      <TicketIcon className='h-4 w-4 text-primary' />
                      Từ {Number(minPrice || 0).toLocaleString()} {currency}
                    </div>
                  </div>

                  <div className='flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-400 sm:text-xs'>
                    {movieGenres?.slice(0, 3).map((genre) => (
                      <span key={genre.id || genre.name} className='rounded-full border border-white/10 px-3 py-2'>
                        {genre.name}
                      </span>
                    ))}
                  </div>

                  <div className='rounded-[1.5rem] border border-white/10 bg-black/15 p-3 sm:p-4'>
                    <div className='mb-4 flex items-center justify-between gap-4'>
                      <p className='text-sm font-medium text-white'>Các suất chiếu trong ngày</p>
                      <p className='text-xs uppercase tracking-[0.22em] text-primary/80'>
                        {showtimes.length} suất
                      </p>
                    </div>

                    <div className='flex flex-wrap gap-2 sm:gap-3'>
                      {showtimes.map((showtime) => (
                        <button
                          key={showtime.showId}
                          type='button'
                          onClick={() => {
                            navigate(`/movies/${movie._id}/${selectedDate}?showId=${showtime.showId}`)
                            scrollTo(0, 0)
                          }}
                          className='group min-w-[120px] rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:border-primary/40 hover:bg-primary/10 sm:min-w-[148px] sm:px-4'
                        >
                          <p className='text-base font-semibold text-white sm:text-lg'>{isoTimeFormat(showtime.time)}</p>
                          <p className='mt-2 inline-flex items-center gap-2 text-xs text-gray-400'>
                            <MapPinIcon className='h-3.5 w-3.5 text-primary' />
                            {showtime.roomName}
                          </p>
                          <p className='mt-1 text-xs text-gray-500'>
                            {Number(showtime.basePrice || 0).toLocaleString()} {currency}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Schedule
