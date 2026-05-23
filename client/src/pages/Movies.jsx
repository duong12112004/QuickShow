import React, { useMemo, useState } from 'react'
import { ChevronDownIcon, FilterIcon, XIcon } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import MovieCard from '../components/MovieCard'
import BlurCircle from '../components/BlurCircle'
import { useAppContext } from '../context/AppContext'
import { getMovieGenres, getMovieTitle } from '../lib/movieDisplay'
import { searchMovies } from '../lib/movieSearch'

const DEFAULT_FILTERS = {
  genre: 'ALL',
  year: 'ALL',
  duration: 'ALL',
  rating: 'ALL',
  sort: 'DEFAULT'
}

const durationOptions = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'SHORT', label: 'Dưới 100 phút' },
  { value: 'MEDIUM', label: '100-130 phút' },
  { value: 'LONG', label: 'Trên 130 phút' }
]

const ratingOptions = [
  { value: 'ALL', label: 'Tất cả' },
  { value: '7', label: 'Từ 7.0' },
  { value: '8', label: 'Từ 8.0' },
  { value: '9', label: 'Từ 9.0' }
]

const sortOptions = [
  { value: 'DEFAULT', label: 'Mặc định' },
  { value: 'TITLE', label: 'Tên phim A-Z' },
  { value: 'RATING', label: 'Điểm cao nhất' },
  { value: 'NEWEST', label: 'Mới phát hành' },
  { value: 'RUNTIME', label: 'Thời lượng ngắn nhất' }
]

const getMovieYear = (movie) => {
  if (!movie?.release_date) {
    return ''
  }

  const year = new Date(movie.release_date).getFullYear()
  return Number.isNaN(year) ? '' : `${year}`
}

const getMovieRating = (movie) => {
  return Number(movie?.imdb_rating || movie?.vote_average || 0)
}

const getMovieRuntime = (movie) => {
  return Number(movie?.runtime || 0)
}

const matchesDuration = (movie, duration) => {
  if (duration === 'ALL') {
    return true
  }

  const runtime = getMovieRuntime(movie)

  if (duration === 'SHORT') {
    return runtime > 0 && runtime < 100
  }

  if (duration === 'MEDIUM') {
    return runtime >= 100 && runtime <= 130
  }

  return runtime > 130
}

const sortMovies = (movies, sort) => {
  const nextMovies = [...movies]

  if (sort === 'TITLE') {
    return nextMovies.sort((left, right) => getMovieTitle(left).localeCompare(getMovieTitle(right), 'vi'))
  }

  if (sort === 'RATING') {
    return nextMovies.sort((left, right) => getMovieRating(right) - getMovieRating(left))
  }

  if (sort === 'NEWEST') {
    return nextMovies.sort((left, right) => new Date(right.release_date || 0) - new Date(left.release_date || 0))
  }

  if (sort === 'RUNTIME') {
    return nextMovies.sort((left, right) => getMovieRuntime(left) - getMovieRuntime(right))
  }

  return nextMovies
}

const Movies = () => {
  const { shows } = useAppContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const query = searchParams.get('q') || ''

  const filterOptions = useMemo(() => {
    const genreSet = new Set()
    const yearSet = new Set()

    shows.forEach((movie) => {
      getMovieGenres(movie).forEach((genre) => {
        if (genre?.name) {
          genreSet.add(genre.name)
        }
      })

      const year = getMovieYear(movie)
      if (year) {
        yearSet.add(year)
      }
    })

    return {
      genres: Array.from(genreSet).sort((left, right) => left.localeCompare(right, 'vi')),
      years: Array.from(yearSet).sort((left, right) => Number(right) - Number(left))
    }
  }, [shows])

  const filteredMovies = useMemo(() => {
    const searchedMovies = searchMovies(shows, query)
    const nextMovies = searchedMovies.filter((movie) => {
      const genreMatches = filters.genre === 'ALL' || getMovieGenres(movie).some((genre) => genre?.name === filters.genre)
      const yearMatches = filters.year === 'ALL' || getMovieYear(movie) === filters.year
      const durationMatches = matchesDuration(movie, filters.duration)
      const ratingMatches = filters.rating === 'ALL' || getMovieRating(movie) >= Number(filters.rating)

      return genreMatches && yearMatches && durationMatches && ratingMatches
    })

    return sortMovies(nextMovies, filters.sort)
  }, [shows, query, filters])

  const updateFilter = (name, value) => {
    setFilters((currentFilters) => ({ ...currentFilters, [name]: value }))
  }

  const clearSearch = () => {
    setSearchParams({})
  }

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS)
  }

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    return value !== DEFAULT_FILTERS[key]
  }).length
  const hasMovies = shows.length > 0
  const hasQuery = query.trim().length > 0
  const hasActiveFilters = activeFilterCount > 0

  return (
    <div className='relative my-40 mb-60 min-h-[80vh] px-6 md:px-16 lg:px-40 xl:px-44'>
      <BlurCircle top='150px' left='0px' />
      <BlurCircle bottom='50px' right='50px' />

      <div className='mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between'>
        <div>
          <h1 className='text-xl font-semibold text-white'>
            {hasQuery ? `Kết quả tìm kiếm cho "${query}"` : 'Phim đang chiếu'}
          </h1>
          <p className='mt-2 text-sm text-gray-400'>
            {hasQuery || hasActiveFilters
              ? `${filteredMovies.length} phim phù hợp`
              : `${shows.length} phim đang mở bán vé`}
          </p>
        </div>

        <div className='flex flex-wrap gap-3'>
          {hasQuery && (
            <button
              type='button'
              onClick={clearSearch}
              className='inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/15'
            >
              <XIcon className='h-4 w-4' />
              Xóa tìm kiếm
            </button>
          )}

          <button
            type='button'
            onClick={() => setIsFilterOpen((current) => !current)}
            className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:border-primary/30 hover:bg-primary/10'
          >
            <FilterIcon className='h-4 w-4 text-primary' />
            Bộ lọc
            {activeFilterCount > 0 && (
              <span className='rounded-full bg-primary px-2 py-0.5 text-xs text-white'>{activeFilterCount}</span>
            )}
            <ChevronDownIcon className={`h-4 w-4 transition ${isFilterOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isFilterOpen && (
        <div className='mb-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 backdrop-blur sm:p-5'>
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
            <label className='space-y-2'>
              <span className='text-xs font-medium uppercase tracking-[0.18em] text-gray-500'>Sắp xếp</span>
              <select
                value={filters.sort}
                onChange={(event) => updateFilter('sort', event.target.value)}
                className='h-11 w-full rounded-xl border border-white/10 bg-[#14151d] px-3 text-sm text-white outline-none transition focus:border-primary/50'
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className='space-y-2'>
              <span className='text-xs font-medium uppercase tracking-[0.18em] text-gray-500'>Thể loại</span>
              <select
                value={filters.genre}
                onChange={(event) => updateFilter('genre', event.target.value)}
                className='h-11 w-full rounded-xl border border-white/10 bg-[#14151d] px-3 text-sm text-white outline-none transition focus:border-primary/50'
              >
                <option value='ALL'>Tất cả thể loại</option>
                {filterOptions.genres.map((genre) => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
            </label>

            <label className='space-y-2'>
              <span className='text-xs font-medium uppercase tracking-[0.18em] text-gray-500'>Năm phát hành</span>
              <select
                value={filters.year}
                onChange={(event) => updateFilter('year', event.target.value)}
                className='h-11 w-full rounded-xl border border-white/10 bg-[#14151d] px-3 text-sm text-white outline-none transition focus:border-primary/50'
              >
                <option value='ALL'>Tất cả năm</option>
                {filterOptions.years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>

            <div className='space-y-2'>
              <span className='text-xs font-medium uppercase tracking-[0.18em] text-gray-500'>Điểm đánh giá</span>
              <div className='grid grid-cols-2 gap-2'>
                {ratingOptions.map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    onClick={() => updateFilter('rating', option.value)}
                    className={`h-11 rounded-xl border px-3 text-sm transition ${
                      filters.rating === option.value
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-white/10 bg-black/10 text-gray-300 hover:border-primary/30 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className='mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
            <div className='space-y-2'>
              <span className='text-xs font-medium uppercase tracking-[0.18em] text-gray-500'>Thời lượng</span>
              <div className='flex flex-wrap gap-2'>
                {durationOptions.map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    onClick={() => updateFilter('duration', option.value)}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      filters.duration === option.value
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-white/10 bg-black/10 text-gray-300 hover:border-primary/30 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <button
                type='button'
                onClick={clearFilters}
                className='inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm font-medium text-gray-300 transition hover:border-primary/30 hover:text-white'
              >
                <XIcon className='h-4 w-4' />
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
      )}

      {!hasMovies ? (
        <div className='flex min-h-[45vh] flex-col items-center justify-center text-center'>
          <h2 className='text-3xl font-bold text-gray-400'>Hiện tại chưa có suất chiếu nào</h2>
        </div>
      ) : filteredMovies.length > 0 ? (
        <div className='flex flex-wrap gap-8 max-sm:justify-center'>
          {filteredMovies.map((movie) => (
            <MovieCard movie={movie} key={movie._id} />
          ))}
        </div>
      ) : (
        <div className='flex min-h-[45vh] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-white/4 px-6 text-center'>
          <h2 className='text-2xl font-semibold text-white'>Không tìm thấy phim phù hợp</h2>
          <p className='mt-3 max-w-md text-sm leading-6 text-gray-400'>
            Hãy thử đổi từ khóa tìm kiếm hoặc giảm bớt điều kiện trong bộ lọc.
          </p>
          <div className='mt-6 flex flex-wrap justify-center gap-3'>
            {hasQuery && (
              <button
                type='button'
                onClick={clearSearch}
                className='rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dull'
              >
                Xóa tìm kiếm
              </button>
            )}
            {hasActiveFilters && (
              <button
                type='button'
                onClick={clearFilters}
                className='rounded-full border border-white/10 px-6 py-2.5 text-sm font-medium text-gray-300 transition hover:border-primary/30 hover:text-white'
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Movies
