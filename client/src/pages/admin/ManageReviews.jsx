import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { EyeIcon, EyeOffIcon, RotateCcwIcon, SearchIcon, StarIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppContext } from '../../context/AppContext'

const statusOptions = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'VISIBLE', label: 'Đang hiển thị' },
  { value: 'HIDDEN', label: 'Đã ẩn' }
]

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

const getMovieTitle = (movie) => {
  if (!movie) return 'Phim không xác định'
  return movie.titleVi || movie.title || 'Phim không xác định'
}

const ManageReviews = () => {
  const { axios, getToken } = useAppContext()
  const [reviews, setReviews] = useState([])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchValue, setSearchValue] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState('')

  const fetchReviews = useCallback(async () => {
    try {
      setIsLoading(true)
      const { data } = await axios.get('/api/admin/reviews', {
        headers: { Authorization: `Bearer ${await getToken()}` },
        params: {
          status: statusFilter,
          q: searchValue.trim()
        }
      })

      if (data.success) {
        setReviews(data.reviews || [])
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error('Không thể tải danh sách bình luận.')
    } finally {
      setIsLoading(false)
    }
  }, [axios, getToken, searchValue, statusFilter])

  const handleHideReview = async (review) => {
    const hiddenReason = window.prompt('Lý do ẩn bình luận:', review.hiddenReason || 'Nội dung không phù hợp.')
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
        await fetchReviews()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error('Không thể ẩn bình luận lúc này.')
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
        await fetchReviews()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error('Không thể khôi phục bình luận lúc này.')
    } finally {
      setProcessingId('')
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(fetchReviews, 250)
    return () => clearTimeout(timeoutId)
  }, [fetchReviews])

  const stats = useMemo(() => ({
    total: reviews.length,
    visible: reviews.filter((review) => review.status === 'VISIBLE').length,
    hidden: reviews.filter((review) => review.status === 'HIDDEN').length
  }), [reviews])

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold text-white'>Quản lý bình luận</h1>
          <p className='mt-2 text-sm text-gray-400'>
            Ẩn hoặc khôi phục bình luận người dùng. Hệ thống không xóa cứng dữ liệu để giữ lịch sử kiểm duyệt.
          </p>
        </div>

        <div className='grid gap-3 sm:grid-cols-3'>
          <div className='rounded-2xl border border-white/10 bg-white/5 px-4 py-3'>
            <p className='text-xs text-gray-500'>Tổng</p>
            <p className='mt-1 text-xl font-semibold'>{stats.total}</p>
          </div>
          <div className='rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-4 py-3'>
            <p className='text-xs text-emerald-200/70'>Hiển thị</p>
            <p className='mt-1 text-xl font-semibold text-emerald-200'>{stats.visible}</p>
          </div>
          <div className='rounded-2xl border border-rose-400/15 bg-rose-400/10 px-4 py-3'>
            <p className='text-xs text-rose-200/70'>Đã ẩn</p>
            <p className='mt-1 text-xl font-semibold text-rose-200'>{stats.hidden}</p>
          </div>
        </div>
      </div>

      <div className='flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:flex-row lg:items-center'>
        <label className='relative flex-1'>
          <SearchIcon className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500' />
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder='Tìm theo phim, người dùng hoặc nội dung...'
            className='h-11 w-full rounded-full border border-white/10 bg-[#111827] pl-11 pr-4 text-sm text-white outline-none focus:border-primary/50'
          />
        </label>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className='h-11 rounded-full border border-white/10 bg-[#111827] px-4 text-sm text-white outline-none focus:border-primary/50'
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className='overflow-hidden rounded-2xl border border-white/10 bg-white/5'>
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[1180px] table-fixed text-left text-sm'>
            <colgroup>
              <col className='w-[18%]' />
              <col className='w-[18%]' />
              <col className='w-[30%]' />
              <col className='w-[8%]' />
              <col className='w-[11%]' />
              <col className='w-[9%]' />
              <col className='w-[6%]' />
            </colgroup>
            <thead className='border-b border-white/10 bg-black/20 text-xs uppercase tracking-[0.18em] text-gray-500'>
              <tr>
                <th className='px-4 py-3'>Phim</th>
                <th className='px-4 py-3'>Người dùng</th>
                <th className='px-4 py-3'>Nội dung</th>
                <th className='px-4 py-3'>Điểm</th>
                <th className='px-4 py-3'>Trạng thái</th>
                <th className='px-4 py-3'>Ngày tạo</th>
                <th className='px-4 py-3 text-right'>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className='px-4 py-10 text-center text-gray-400'>Đang tải bình luận...</td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className='px-4 py-10 text-center text-gray-400'>Không có bình luận phù hợp.</td>
                </tr>
              ) : reviews.map((review) => (
                <tr key={review._id} className='border-b border-white/10 align-top last:border-0'>
                  <td className='px-4 py-4'>
                    <p className='line-clamp-2 break-words font-medium text-white'>{getMovieTitle(review.movie)}</p>
                    {review.movie?.title && review.movie?.titleVi && review.movie.title !== review.movie.titleVi && (
                      <p className='mt-1 line-clamp-2 break-words text-xs text-gray-500'>{review.movie.title}</p>
                    )}
                  </td>
                  <td className='px-4 py-4'>
                    <div className='flex items-center gap-3'>
                      {review.userImage ? (
                        <img src={review.userImage} alt={review.userName} className='h-9 w-9 rounded-full object-cover' />
                      ) : (
                        <div className='flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary'>
                          {review.userName?.charAt(0) || 'Q'}
                        </div>
                      )}
                      <div>
                        <p className='line-clamp-2 break-words font-medium text-white'>{review.userName}</p>
                        {review.isVerifiedViewer && (
                          <p className='text-xs text-emerald-300'>Đã xem</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className='px-4 py-4'>
                    <p className='line-clamp-5 whitespace-pre-line break-words text-gray-300'>{review.comment || 'Không có bình luận.'}</p>
                    {review.hasSpoiler && (
                      <span className='mt-2 inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-xs text-amber-200'>
                        Spoiler
                      </span>
                    )}
                    {review.hiddenReason && (
                      <p className='mt-2 rounded-lg border border-rose-400/20 bg-rose-400/10 px-2 py-1 text-xs text-rose-200'>
                        Lý do ẩn: {review.hiddenReason}
                      </p>
                    )}
                  </td>
                  <td className='px-4 py-4'>
                    {review.rating ? (
                      <span className='inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-primary'>
                        <StarIcon className='h-3.5 w-3.5 fill-primary' />
                        {review.rating}/10
                      </span>
                    ) : (
                      <span className='text-gray-500'>-</span>
                    )}
                  </td>
                  <td className='px-4 py-4'>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      review.status === 'VISIBLE'
                        ? 'bg-emerald-400/10 text-emerald-200'
                        : 'bg-rose-400/10 text-rose-200'
                    }`}>
                      {review.status === 'VISIBLE' ? <EyeIcon className='h-3.5 w-3.5' /> : <EyeOffIcon className='h-3.5 w-3.5' />}
                      {review.status === 'VISIBLE' ? 'Hiển thị' : 'Đã ẩn'}
                    </span>
                  </td>
                  <td className='px-4 py-4 text-xs text-gray-400'>{formatDateTime(review.createdAt)}</td>
                  <td className='px-4 py-4 text-right'>
                    {review.status === 'VISIBLE' ? (
                      <button
                        type='button'
                        onClick={() => handleHideReview(review)}
                        disabled={processingId === review._id}
                        className='inline-flex items-center gap-2 rounded-full border border-rose-400/30 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-400/10 disabled:opacity-60'
                      >
                        <EyeOffIcon className='h-4 w-4' />
                        Ẩn
                      </button>
                    ) : (
                      <button
                        type='button'
                        onClick={() => handleRestoreReview(review)}
                        disabled={processingId === review._id}
                        className='inline-flex items-center gap-2 rounded-full border border-emerald-400/30 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/10 disabled:opacity-60'
                      >
                        <RotateCcwIcon className='h-4 w-4' />
                        Khôi phục
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ManageReviews
