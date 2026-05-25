import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  EyeIcon,
  EyeOffIcon,
  FilterX,
  MessageSquareIcon,
  RotateCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
  StarIcon
} from 'lucide-react'
import toast from 'react-hot-toast'
import AdminPagination from '../../components/admin/AdminPagination'
import Title from '../../components/admin/Title'
import { useAppContext } from '../../context/AppContext'

const PAGE_SIZE = 7

const statusOptions = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'VISIBLE', label: 'Đang hiển thị' },
  { value: 'HIDDEN', label: 'Đã ẩn' }
]

const typeOptions = [
  { value: 'ALL', label: 'Tất cả đánh giá' },
  { value: 'WITH_COMMENT', label: 'Có bình luận' },
  { value: 'RATING_ONLY', label: 'Chỉ chấm điểm' },
  { value: 'SPOILER', label: 'Có spoiler' },
  { value: 'VERIFIED', label: 'Đã xem phim' }
]

const darkInputClassName = 'w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-primary'
const darkSelectClassName = 'w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-primary'
const darkOptionClassName = 'bg-slate-950 text-white'

const formatDateTime = (value) => {
  if (!value) return ''

  return new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const getMovieTitle = (movie, review) => {
  if (movie?.titleVi || movie?.title) return movie.titleVi || movie.title
  return review.booking?.movieTitle || 'Phim không xác định'
}

const getRoomName = (review) => {
  return review.booking?.roomName || review.show?.room?.name || 'Chưa có dữ liệu'
}

const getShowDateTime = (review) => {
  return review.booking?.showDateTime || review.show?.showDateTime || ''
}

const getReviewType = (review) => {
  if (review.comment?.trim()) return 'Có bình luận'
  return 'Chỉ chấm điểm'
}

const ManageReviews = () => {
  const { axios, getToken, image_base_url } = useAppContext()
  const [reviews, setReviews] = useState([])
  const [filters, setFilters] = useState({
    q: '',
    status: 'ALL',
    type: 'ALL'
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [processingId, setProcessingId] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const fetchReviews = useCallback(async (nextFilters, options = {}) => {
    const { silent = false } = options
    const requestFilters = nextFilters || { q: '', status: 'ALL' }

    try {
      if (silent) {
        setIsFetching(true)
      } else {
        setIsLoading(true)
      }

      const { data } = await axios.get('/api/admin/reviews', {
        headers: { Authorization: `Bearer ${await getToken()}` },
        params: {
          status: requestFilters.status,
          q: requestFilters.q.trim()
        }
      })

      if (data.success) {
        setReviews(data.reviews || [])
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error('Không thể tải danh sách đánh giá.')
    } finally {
      setIsLoading(false)
      setIsFetching(false)
    }
  }, [axios, getToken])

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setCurrentPage(1)
  }

  const handleResetFilters = () => {
    setFilters({ q: '', status: 'ALL', type: 'ALL' })
    setCurrentPage(1)
  }

  const handleHideReview = async (review) => {
    const hiddenReason = window.prompt('Lý do ẩn đánh giá:', review.hiddenReason || 'Nội dung không phù hợp.')
    if (hiddenReason === null) return

    try {
      setProcessingId(review._id)
      const { data } = await axios.patch(`/api/admin/reviews/${review._id}/hide`, {
        hiddenReason
      }, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      })

      if (data.success) {
        toast.success(data.message)
        await fetchReviews(filters, { silent: true })
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error('Không thể ẩn đánh giá lúc này.')
    } finally {
      setProcessingId('')
    }
  }

  const handleRestoreReview = async (review) => {
    try {
      setProcessingId(review._id)
      const { data } = await axios.patch(`/api/admin/reviews/${review._id}/restore`, {}, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      })

      if (data.success) {
        toast.success(data.message)
        await fetchReviews(filters, { silent: true })
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error('Không thể khôi phục đánh giá lúc này.')
    } finally {
      setProcessingId('')
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchReviews({ q: filters.q, status: filters.status }, { silent: !isLoading })
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [fetchReviews, filters.q, filters.status, isLoading])

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      if (filters.type === 'WITH_COMMENT') return Boolean(review.comment?.trim())
      if (filters.type === 'RATING_ONLY') return !review.comment?.trim()
      if (filters.type === 'SPOILER') return review.hasSpoiler
      if (filters.type === 'VERIFIED') return review.isVerifiedViewer
      return true
    })
  }, [filters.type, reviews])

  const stats = useMemo(() => {
    const ratedReviews = reviews.filter((review) => review.rating)
    const averageRating = ratedReviews.length
      ? ratedReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / ratedReviews.length
      : 0

    return {
      total: reviews.length,
      visible: reviews.filter((review) => review.status === 'VISIBLE').length,
      hidden: reviews.filter((review) => review.status === 'HIDDEN').length,
      withComment: reviews.filter((review) => review.comment?.trim()).length,
      averageRating
    }
  }, [reviews])

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / PAGE_SIZE))
  const paginatedReviews = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredReviews.slice(startIndex, startIndex + PAGE_SIZE)
  }, [currentPage, filteredReviews])
  const startRow = filteredReviews.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const endRow = Math.min(currentPage * PAGE_SIZE, filteredReviews.length)

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  return (
    <div className='space-y-8'>
      <Title text1='Quản lý' text2='Đánh giá' />

      <div className='grid gap-4 md:grid-cols-5'>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Tổng đánh giá</p>
          <p className='mt-2 text-2xl font-semibold text-white'>{stats.total}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Đang hiển thị</p>
          <p className='mt-2 text-2xl font-semibold text-emerald-300'>{stats.visible}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Đã ẩn</p>
          <p className='mt-2 text-2xl font-semibold text-rose-300'>{stats.hidden}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Có bình luận</p>
          <p className='mt-2 text-2xl font-semibold text-fuchsia-300'>{stats.withComment}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Điểm trung bình</p>
          <p className='mt-2 text-2xl font-semibold text-yellow-300'>
            {stats.averageRating ? stats.averageRating.toFixed(1) : '-'}
          </p>
        </div>
      </div>

      <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
          <div>
            <p className='text-lg font-semibold text-white'>Bộ lọc đánh giá</p>
            <p className='text-sm text-gray-400'>
              Tìm theo phim, người dùng hoặc nội dung. Mỗi trang hiển thị 7 đánh giá.
            </p>
          </div>

          <button
            type='button'
            onClick={handleResetFilters}
            className='inline-flex w-fit items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5'
          >
            <FilterX className='h-4 w-4' />
            Đặt lại
          </button>
        </div>

        <div className='mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]'>
          <label className='relative block'>
            <SearchIcon className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500' />
            <input
              value={filters.q}
              onChange={(event) => handleFilterChange('q', event.target.value)}
              placeholder='Tìm theo phim, người dùng hoặc nội dung đánh giá'
              className={`${darkInputClassName} pl-11`}
            />
          </label>

          <select
            value={filters.status}
            onChange={(event) => handleFilterChange('status', event.target.value)}
            className={darkSelectClassName}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value} className={darkOptionClassName}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={filters.type}
            onChange={(event) => handleFilterChange('type', event.target.value)}
            className={darkSelectClassName}
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value} className={darkOptionClassName}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className='mt-4 flex items-center justify-between text-xs text-gray-400'>
          <p>
            {filteredReviews.length > 0
              ? `Đang hiển thị ${startRow}-${endRow} trên tổng ${filteredReviews.length} đánh giá`
              : 'Không có đánh giá phù hợp'}
          </p>
          {isFetching && <p>Đang cập nhật dữ liệu...</p>}
        </div>
      </div>

      <div className='overflow-x-auto rounded-2xl border border-primary/20 bg-primary/8'>
        <table className='w-full min-w-[1300px] border-collapse text-left text-sm'>
          <thead>
            <tr className='border-b border-primary/20 bg-primary/12 text-white'>
              <th className='p-3 pl-5 font-medium'>Phim / booking</th>
              <th className='p-3 font-medium'>Người dùng</th>
              <th className='p-3 font-medium'>Điểm</th>
              <th className='p-3 font-medium'>Nội dung</th>
              <th className='p-3 font-medium'>Trạng thái</th>
              <th className='p-3 font-medium'>Thời gian</th>
              <th className='p-3 font-medium text-right'>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className='p-6 text-center text-gray-400'>Đang tải đánh giá...</td>
              </tr>
            ) : paginatedReviews.map((review) => {
              const movieTitle = getMovieTitle(review.movie, review)
              const posterPath = review.movie?.poster_path
              const showDateTime = getShowDateTime(review)
              const roomName = getRoomName(review)

              return (
                <tr key={review._id} className='border-b border-primary/15 align-top even:bg-white/2 last:border-0'>
                  <td className='p-3 pl-5'>
                    <div className='flex gap-3'>
                      {posterPath ? (
                        <img
                          src={image_base_url + posterPath}
                          alt={movieTitle}
                          className='h-20 w-14 shrink-0 rounded-xl object-cover'
                        />
                      ) : (
                        <div className='flex h-20 w-14 shrink-0 items-center justify-center rounded-xl bg-black/20 text-[10px] text-gray-500'>
                          No poster
                        </div>
                      )}
                      <div className='min-w-0'>
                        <p className='line-clamp-2 font-medium text-white'>{movieTitle}</p>
                        {review.booking?.bookingCode && (
                          <p className='mt-1 text-xs font-semibold text-primary'>{review.booking.bookingCode}</p>
                        )}
                        <p className='mt-1 text-xs text-gray-400'>Phòng: {roomName}</p>
                        {showDateTime && (
                          <p className='mt-1 text-xs text-gray-400'>{formatDateTime(showDateTime)}</p>
                        )}
                        {review.booking?.bookedSeats?.length > 0 && (
                          <p className='mt-1 max-w-64 truncate text-xs text-gray-400'>
                            Ghế: {review.booking.bookedSeats.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className='p-3'>
                    <div className='flex items-center gap-3'>
                      {review.userImage ? (
                        <img src={review.userImage} alt={review.userName} className='h-10 w-10 rounded-full object-cover' />
                      ) : (
                        <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary'>
                          {review.userName?.charAt(0) || 'Q'}
                        </div>
                      )}
                      <div className='min-w-0'>
                        <p className='line-clamp-2 wrap-break-word font-medium text-white'>{review.userName || 'Người dùng QuickShow'}</p>
                        <p className='mt-1 text-xs text-gray-400'>{getReviewType(review)}</p>
                        {review.isVerifiedViewer && (
                          <p className='mt-1 inline-flex items-center gap-1 text-xs text-emerald-300'>
                            <ShieldCheckIcon className='h-3.5 w-3.5' />
                            Đã xem phim
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className='p-3'>
                    {review.rating ? (
                      <div className='space-y-2'>
                        <span className='inline-flex items-center gap-1.5 rounded-full border border-yellow-300/25 bg-yellow-300/10 px-3 py-1 text-yellow-300'>
                          <StarIcon className='h-3.5 w-3.5 fill-yellow-300' />
                          {review.rating}/10
                        </span>
                        <div className='flex max-w-28 flex-wrap gap-0.5'>
                          {Array.from({ length: 10 }, (_, index) => (
                            <StarIcon
                              key={index}
                              className={`h-3 w-3 ${index < review.rating ? 'fill-yellow-300 text-yellow-300' : 'text-gray-600'}`}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className='text-gray-500'>-</span>
                    )}
                  </td>

                  <td className='p-3'>
                    {review.comment?.trim() ? (
                      <p className='line-clamp-5 max-w-[420px] whitespace-pre-line wrap-break-word text-gray-300'>
                        {review.comment}
                      </p>
                    ) : (
                      <span className='text-gray-500'>-</span>
                    )}

                    <div className='mt-2 flex flex-wrap gap-2'>
                      {review.hasSpoiler && (
                        <span className='inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-xs text-amber-200'>
                          Spoiler
                        </span>
                      )}
                      {review.comment?.trim() && (
                        <span className='inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-300'>
                          <MessageSquareIcon className='h-3.5 w-3.5' />
                          Bình luận
                        </span>
                      )}
                    </div>

                    {review.hiddenReason && (
                      <p className='mt-2 max-w-[420px] rounded-lg border border-rose-400/20 bg-rose-400/10 px-2 py-1 text-xs text-rose-200'>
                        Lý do ẩn: {review.hiddenReason}
                      </p>
                    )}
                  </td>

                  <td className='p-3'>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      review.status === 'VISIBLE'
                        ? 'bg-emerald-400/10 text-emerald-200'
                        : 'bg-rose-400/10 text-rose-200'
                    }`}>
                      {review.status === 'VISIBLE' ? <EyeIcon className='h-3.5 w-3.5' /> : <EyeOffIcon className='h-3.5 w-3.5' />}
                      {review.status === 'VISIBLE' ? 'Hiển thị' : 'Đã ẩn'}
                    </span>
                  </td>

                  <td className='p-3 text-xs text-gray-400'>
                    <p>Tạo: {formatDateTime(review.createdAt)}</p>
                    {review.updatedAt && review.updatedAt !== review.createdAt && (
                      <p className='mt-1'>Cập nhật: {formatDateTime(review.updatedAt)}</p>
                    )}
                  </td>

                  <td className='p-3 text-right'>
                    {review.status === 'VISIBLE' ? (
                      <button
                        type='button'
                        onClick={() => handleHideReview(review)}
                        disabled={processingId === review._id}
                        className='inline-flex items-center gap-2 rounded-full border border-rose-400/40 px-4 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60'
                      >
                        <EyeOffIcon className='h-4 w-4' />
                        Ẩn
                      </button>
                    ) : (
                      <button
                        type='button'
                        onClick={() => handleRestoreReview(review)}
                        disabled={processingId === review._id}
                        className='inline-flex items-center gap-2 rounded-full border border-emerald-400/40 px-4 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60'
                      >
                        <RotateCcwIcon className='h-4 w-4' />
                        Khôi phục
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {!isLoading && filteredReviews.length === 0 && (
          <div className='p-6 text-sm text-gray-400'>
            Không có đánh giá nào phù hợp với bộ lọc hiện tại.
          </div>
        )}
      </div>

      <AdminPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        disabled={filteredReviews.length === 0}
      />
    </div>
  )
}

export default ManageReviews
