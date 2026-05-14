import React, { useEffect, useMemo, useState } from 'react'
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  PenSquare,
  PlusCircle,
  RefreshCw,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Loading from '../../components/Loading'
import Title from '../../components/admin/Title'
import { useAppContext } from '../../context/AppContext'
import { dateFormat, formatToDateTimeLocal, getCurrentDateTimeLocal } from '../../lib/dateFormat'

const DEFAULT_CLEANUP_MINUTES = 15
const PAGE_SIZE = 8

const defaultForm = {
  movieId: '',
  roomId: '',
  showDateTime: '',
  basePrice: '',
  cleanupMinutes: DEFAULT_CLEANUP_MINUTES,
}

const lifecycleLabelMap = {
  UPCOMING: 'Sắp chiếu',
  IN_PROGRESS: 'Đang chiếu',
  ENDED: 'Đã kết thúc',
  CANCELLED: 'Đã hủy',
}

const formatMoney = (value, currency) => `${Number(value || 0).toLocaleString()} ${currency}`

const formatDuration = (minutes) => {
  const totalMinutes = Number(minutes || 0)
  const hours = Math.floor(totalMinutes / 60)
  const remain = totalMinutes % 60

  if (!hours) return `${remain} phút`
  if (!remain) return `${hours} giờ`
  return `${hours} giờ ${remain} phút`
}

const formatShortDate = (value) =>
  new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const ManageShowtimes = () => {
  const { axios, getToken, user, fetchShows } = useAppContext()
  const currency = import.meta.env.VITE_CURRENCY

  const [showtimes, setShowtimes] = useState([])
  const [rooms, setRooms] = useState([])
  const [nowPlayingMovies, setNowPlayingMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedShowtime, setSelectedShowtime] = useState(null)
  const [formData, setFormData] = useState(defaultForm)
  const [searchValue, setSearchValue] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dateFilter, setDateFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [deletingId, setDeletingId] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  const requestConfig = async () => ({
    headers: { Authorization: `Bearer ${await getToken()}` },
  })

  const resetForm = () => {
    setSelectedShowtime(null)
    setFormData({
      ...defaultForm,
      showDateTime: getCurrentDateTimeLocal(),
    })
  }

  const fetchBootstrapData = async () => {
    try {
      const config = await requestConfig()
      const [showtimeResponse, roomResponse, movieResponse] = await Promise.all([
        axios.get('/api/admin/showtimes', config),
        axios.get('/api/admin/rooms', config),
        axios.get('/api/show/now-playing', config),
      ])

      if (showtimeResponse.data.success) {
        setShowtimes(showtimeResponse.data.showtimes || [])
      } else {
        toast.error(showtimeResponse.data.message)
      }

      if (roomResponse.data.success) {
        setRooms(roomResponse.data.rooms || [])
      } else {
        toast.error(roomResponse.data.message)
      }

      if (movieResponse.data.success) {
        setNowPlayingMovies(movieResponse.data.movies || [])
      } else {
        toast.error(movieResponse.data.message)
      }
    } catch {
      toast.error('Không tải được dữ liệu suất chiếu.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (user) {
      resetForm()
      fetchBootstrapData()
    }
  }, [user])

  const movieOptionsMap = new Map()

  nowPlayingMovies.forEach((movie) => {
    movieOptionsMap.set(String(movie.id), {
      _id: String(movie.id),
      title: movie.title,
      runtime: movie.runtime || 0,
    })
  })

  showtimes.forEach((showtime) => {
    if (showtime.movie?._id) {
      movieOptionsMap.set(String(showtime.movie._id), {
        _id: String(showtime.movie._id),
        title: showtime.movie.title,
        runtime: showtime.runtimeMinutes || showtime.movie.runtime || 0,
      })
    }
  })

  const movieOptions = Array.from(movieOptionsMap.values()).sort((a, b) => a.title.localeCompare(b.title))

  const filteredShowtimes = useMemo(() => {
    return showtimes.filter((showtime) => {
      const search = searchValue.trim().toLowerCase()
      const movieTitle = `${showtime.movie?.title || ''}`.toLowerCase()
      const roomName = `${showtime.room?.name || ''}`.toLowerCase()
      const localDate = showtime.showDateTime ? new Date(showtime.showDateTime).toLocaleDateString('en-CA') : ''

      if (search && !movieTitle.includes(search) && !roomName.includes(search)) return false
      if (statusFilter !== 'ALL' && showtime.lifecycle !== statusFilter) return false
      if (dateFilter && localDate !== dateFilter) return false

      return true
    })
  }, [showtimes, searchValue, statusFilter, dateFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchValue, statusFilter, dateFilter])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredShowtimes.length / PAGE_SIZE))
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [filteredShowtimes.length, currentPage])

  const totalPages = Math.max(1, Math.ceil(filteredShowtimes.length / PAGE_SIZE))
  const paginatedShowtimes = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredShowtimes.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredShowtimes, currentPage])
  const startRow = filteredShowtimes.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const endRow = Math.min(currentPage * PAGE_SIZE, filteredShowtimes.length)

  const selectedMovie = movieOptions.find((movie) => movie._id === formData.movieId)
  const selectedRoom = rooms.find((room) => room._id === formData.roomId)

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchBootstrapData()
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleEdit = (showtime) => {
    setSelectedShowtime(showtime)
    setFormData({
      movieId: String(showtime.movie?._id || ''),
      roomId: showtime.room?._id || '',
      showDateTime: formatToDateTimeLocal(showtime.showDateTime),
      basePrice: showtime.basePrice || '',
      cleanupMinutes: showtime.cleanupMinutes ?? DEFAULT_CLEANUP_MINUTES,
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.movieId || !formData.roomId || !formData.showDateTime || !formData.basePrice) {
      return toast.error('Cần nhập đầy đủ phim, phòng, giờ chiếu và giá vé.')
    }

    const payload = {
      movieId: formData.movieId,
      roomId: formData.roomId,
      showDateTime: formData.showDateTime,
      basePrice: Number(formData.basePrice),
      cleanupMinutes: Number(formData.cleanupMinutes),
    }

    try {
      setSaving(true)
      const config = await requestConfig()
      const { data } = selectedShowtime
        ? await axios.put(`/api/admin/showtimes/${selectedShowtime._id}`, payload, config)
        : await axios.post('/api/admin/showtimes', payload, config)

      if (!data.success) {
        toast.error(data.message)
        return
      }

      toast.success(data.message)
      resetForm()
      await Promise.all([fetchBootstrapData(), fetchShows()])
    } catch {
      toast.error('Không lưu được suất chiếu.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (showtime) => {
    const confirmed = window.confirm(`Xóa suất chiếu ${showtime.movie?.title} lúc ${formatShortDate(showtime.showDateTime)}?`)
    if (!confirmed) return

    try {
      setDeletingId(showtime._id)
      const config = await requestConfig()
      const { data } = await axios.delete(`/api/admin/showtimes/${showtime._id}`, config)

      if (!data.success) {
        toast.error(data.message)
        return
      }

      if (selectedShowtime?._id === showtime._id) {
        resetForm()
      }

      toast.success(data.message)
      await Promise.all([fetchBootstrapData(), fetchShows()])
    } catch {
      toast.error('Không xóa được suất chiếu.')
    } finally {
      setDeletingId('')
    }
  }

  const submitCancelShowtime = async () => {
    if (!cancelTarget) return
    if (!cancelReason.trim()) {
      return toast.error('Cần nhập lý do hủy suất chiếu.')
    }

    try {
      setCancelSubmitting(true)
      const config = await requestConfig()
      const { data } = await axios.patch(
        `/api/admin/showtimes/${cancelTarget._id}/cancel`,
        { cancellationReason: cancelReason.trim() },
        config
      )

      if (!data.success) {
        toast.error(data.message)
        return
      }

      if (selectedShowtime?._id === cancelTarget._id) {
        resetForm()
      }

      toast.success(data.message)
      setCancelTarget(null)
      setCancelReason('')
      await Promise.all([fetchBootstrapData(), fetchShows()])
    } catch {
      toast.error('Không hủy được suất chiếu.')
    } finally {
      setCancelSubmitting(false)
    }
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className='space-y-8'>
      <Title text1='Quản lý' text2='Suất chiếu' />

      <div className='grid gap-6 xl:grid-cols-[1.25fr_0.75fr]'>
        <div className='rounded-2xl border border-white/10 bg-white/5 p-5'>
          <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
            <div>
              <h2 className='text-lg font-medium'>Danh sách suất chiếu</h2>
              <p className='text-sm text-gray-400'>Giữ lại các thông tin vận hành quan trọng: phim, phòng, lịch chiếu, trạng thái và số ghế đã bán.</p>
            </div>

            <div className='flex flex-wrap gap-2'>
              <button
                onClick={handleRefresh}
                className='inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/10'
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
              <button
                onClick={resetForm}
                className='inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20'
              >
                <PlusCircle className='h-4 w-4' />
                Tạo suất mới
              </button>
            </div>
          </div>

          <div className='mt-5 grid gap-3 md:grid-cols-3'>
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder='Tìm theo phim hoặc phòng'
              className='rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none'
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className='rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none'
            >
              <option value='ALL'>Tất cả trạng thái</option>
              <option value='UPCOMING'>Sắp chiếu</option>
              <option value='IN_PROGRESS'>Đang chiếu</option>
              <option value='ENDED'>Đã kết thúc</option>
              <option value='CANCELLED'>Đã hủy</option>
            </select>

            <input
              type='date'
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className='rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none'
            />
          </div>

          <div className='mt-5 overflow-x-auto'>
            <table className='min-w-full text-sm'>
              <thead className='text-left text-gray-400'>
                <tr className='border-b border-white/10'>
                  <th className='px-3 py-3 font-medium'>Phim</th>
                  <th className='px-3 py-3 font-medium'>Phòng</th>
                  <th className='px-3 py-3 font-medium'>Lịch chiếu</th>
                  <th className='px-3 py-3 font-medium'>Trạng thái</th>
                  <th className='px-3 py-3 font-medium'>Đã bán</th>
                  <th className='px-3 py-3 font-medium text-right'>Tác vụ</th>
                </tr>
              </thead>
              <tbody>
                {paginatedShowtimes.map((showtime) => {
                  const canEdit =
                    showtime.lifecycle === 'UPCOMING' &&
                    showtime.status === 'SCHEDULED' &&
                    !showtime.hasSales &&
                    showtime.heldSeatCount === 0

                  const canCancel =
                    showtime.status === 'SCHEDULED' &&
                    showtime.lifecycle !== 'ENDED'

                  const canDelete =
                    (showtime.lifecycle === 'UPCOMING' || showtime.lifecycle === 'CANCELLED') &&
                    !showtime.hasSales &&
                    showtime.heldSeatCount === 0

                  return (
                    <tr key={showtime._id} className='border-b border-white/5'>
                      <td className='px-3 py-4'>
                        <p className='font-medium text-white'>{showtime.movie?.title}</p>
                        <p className='text-xs text-gray-500'>
                          {formatMoney(showtime.basePrice, currency)}
                        </p>
                      </td>
                      <td className='px-3 py-4 text-gray-300'>
                        <p>{showtime.room?.name}</p>
                        <p className='text-xs text-gray-500'>{showtime.room?.roomType}</p>
                      </td>
                      <td className='px-3 py-4 text-gray-300'>
                        <p>{dateFormat(showtime.showDateTime)}</p>
                        <p className='text-xs text-gray-500'>
                          Kết thúc dự kiến: {formatShortDate(showtime.endDateTime)}
                        </p>
                      </td>
                      <td className='px-3 py-4'>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${
                          showtime.lifecycle === 'UPCOMING'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : showtime.lifecycle === 'IN_PROGRESS'
                              ? 'bg-sky-500/15 text-sky-300'
                              : showtime.lifecycle === 'CANCELLED'
                                ? 'bg-red-500/15 text-red-300'
                                : 'bg-gray-500/15 text-gray-300'
                        }`}>
                          {lifecycleLabelMap[showtime.lifecycle] || showtime.lifecycle}
                        </span>
                        {showtime.lifecycle === 'CANCELLED' && showtime.cancellationReason && (
                          <p className='mt-1 text-xs text-red-300'>{showtime.cancellationReason}</p>
                        )}
                      </td>
                      <td className='px-3 py-4 text-gray-300'>
                        <p>{showtime.soldSeatCount} ghế</p>
                        {showtime.heldSeatCount > 0 && (
                          <p className='text-xs text-amber-300'>Giữ chỗ: {showtime.heldSeatCount}</p>
                        )}
                      </td>
                      <td className='px-3 py-4'>
                        <div className='flex flex-wrap justify-end gap-2'>
                          <button
                            onClick={() => handleEdit(showtime)}
                            disabled={!canEdit}
                            className='inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 px-3 py-1.5 text-xs text-sky-300 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-40'
                          >
                            <PenSquare className='h-3.5 w-3.5' />
                            Sửa
                          </button>
                          <button
                            onClick={() => {
                              setCancelTarget(showtime)
                              setCancelReason(showtime.cancellationReason || '')
                            }}
                            disabled={!canCancel}
                            className='inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40'
                          >
                            <CirclePause className='h-3.5 w-3.5' />
                            Hủy
                          </button>
                          <button
                            onClick={() => handleDelete(showtime)}
                            disabled={deletingId === showtime._id || !canDelete}
                            className='inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40'
                          >
                            <Trash2 className='h-3.5 w-3.5' />
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {!loading && filteredShowtimes.length === 0 && (
              <div className='py-8 text-center text-sm text-gray-400'>Chưa có suất chiếu phù hợp với bộ lọc.</div>
            )}
          </div>

          {filteredShowtimes.length > 0 && (
            <div className='mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 md:flex-row md:items-center md:justify-between'>
              <p className='text-sm text-gray-400'>
                Hiển thị {startRow}-{endRow} trên tổng {filteredShowtimes.length} suất chiếu
              </p>

              <div className='flex items-center gap-2 self-end md:self-auto'>
                <button
                  type='button'
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className='inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40'
                >
                  <ChevronLeft className='h-4 w-4' />
                  Trước
                </button>

                <div className='rounded-lg border border-white/10 px-3 py-2 text-sm text-white'>
                  Trang {currentPage}/{totalPages}
                </div>

                <button
                  type='button'
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className='inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40'
                >
                  Sau
                  <ChevronRight className='h-4 w-4' />
                </button>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className='rounded-2xl border border-white/10 bg-white/5 p-5'>
          <div className='flex items-center justify-between gap-4'>
            <div>
              <h2 className='text-lg font-medium'>{selectedShowtime ? 'Cập nhật suất chiếu' : 'Tạo suất chiếu mới'}</h2>
              <p className='text-sm text-gray-400'>
                Chỉ giữ các trường cần thiết để xếp lịch thực tế và tránh thao tác rối.
              </p>
            </div>
            {selectedShowtime && (
              <button
                type='button'
                onClick={resetForm}
                className='inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-gray-300 hover:bg-white/10'
              >
                <XCircle className='h-4 w-4' />
                Bỏ chọn
              </button>
            )}
          </div>

          <div className='mt-5 space-y-4'>
            <div>
              <label className='mb-2 block text-sm text-gray-300'>Phim</label>
              <select
                name='movieId'
                value={formData.movieId}
                onChange={handleChange}
                className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none'
              >
                <option value=''>Chọn phim</option>
                {movieOptions.map((movie) => (
                  <option key={movie._id} value={movie._id}>
                    {movie.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className='mb-2 block text-sm text-gray-300'>Phòng chiếu</label>
              <select
                name='roomId'
                value={formData.roomId}
                onChange={handleChange}
                className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none'
              >
                <option value=''>Chọn phòng</option>
                {rooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.name} ({room.roomType} - {room.status})
                  </option>
                ))}
              </select>
            </div>

            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-1'>
              <div>
                <label className='mb-2 block text-sm text-gray-300'>Giờ chiếu</label>
                <input
                  type='datetime-local'
                  name='showDateTime'
                  min={getCurrentDateTimeLocal()}
                  value={formData.showDateTime}
                  onChange={handleChange}
                  className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none'
                />
              </div>

              <div>
                <label className='mb-2 block text-sm text-gray-300'>Giá vé cơ bản</label>
                <input
                  type='number'
                  min='1000'
                  step='1000'
                  name='basePrice'
                  value={formData.basePrice}
                  onChange={handleChange}
                  placeholder='85000'
                  className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none'
                />
              </div>
            </div>

            <div>
              <label className='mb-2 block text-sm text-gray-300'>Thời gian dọn phòng sau suất (phút)</label>
              <input
                type='number'
                min='0'
                max='90'
                name='cleanupMinutes'
                value={formData.cleanupMinutes}
                onChange={handleChange}
                className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none'
              />
            </div>
          </div>

          <div className='mt-5 rounded-2xl border border-primary/15 bg-primary/5 p-4'>
            <p className='text-sm font-medium text-white'>Thông tin kiểm tra</p>
            <div className='mt-3 space-y-2 text-sm text-gray-300'>
              <p>Runtime phim: <span className='text-white'>{selectedMovie?.runtime ? formatDuration(selectedMovie.runtime) : 'Lấy từ dữ liệu phim'}</span></p>
              <p>Dọn phòng: <span className='text-white'>{formatDuration(formData.cleanupMinutes || 0)}</span></p>
              {selectedRoom && (
                <p>Phòng chọn: <span className='text-white'>{selectedRoom.name} • {selectedRoom.roomType}</span></p>
              )}
            </div>
            <p className='mt-3 text-xs text-gray-400'>
              Hệ thống sẽ tự chặn lịch trong quá khứ, lịch đè nhau cùng phòng và khóa sửa/xóa khi suất đã có vé.
            </p>
          </div>

          {selectedShowtime && (
            <div className='mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300'>
              <p className='font-medium text-white'>{selectedShowtime.movie?.title}</p>
              <p className='mt-1'>{dateFormat(selectedShowtime.showDateTime)}</p>
              <p className='text-xs text-gray-500'>
                Trạng thái: {lifecycleLabelMap[selectedShowtime.lifecycle] || selectedShowtime.lifecycle}
              </p>
            </div>
          )}

          <button
            type='submit'
            disabled={saving}
            className='mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {selectedShowtime ? <Save className='h-4 w-4' /> : <CalendarPlus className='h-4 w-4' />}
            {saving ? 'Đang xử lý...' : selectedShowtime ? 'Lưu cập nhật suất chiếu' : 'Tạo suất chiếu'}
          </button>
        </form>
      </div>

      {cancelTarget && (
        <div className='fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4'>
          <div className='w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-6'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <h3 className='text-lg font-medium text-white'>Hủy suất chiếu</h3>
                <p className='mt-1 text-sm text-gray-400'>
                  {cancelTarget.movie?.title} • {dateFormat(cancelTarget.showDateTime)}
                </p>
              </div>
              <button
                onClick={() => {
                  setCancelTarget(null)
                  setCancelReason('')
                }}
                className='rounded-lg border border-white/10 p-2 text-gray-300 hover:bg-white/10'
              >
                <XCircle className='h-4 w-4' />
              </button>
            </div>

            <div className='mt-5'>
              <label className='mb-2 block text-sm text-gray-300'>Lý do hủy</label>
              <textarea
                rows={4}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder='VD: bảo trì đột xuất, đổi lịch phát hành, lỗi kỹ thuật...'
                className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none'
              />
            </div>

            <div className='mt-5 flex justify-end gap-3'>
              <button
                onClick={() => {
                  setCancelTarget(null)
                  setCancelReason('')
                }}
                className='rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/10'
              >
                Đóng
              </button>
              <button
                onClick={submitCancelShowtime}
                disabled={cancelSubmitting}
                className='rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60'
              >
                {cancelSubmitting ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManageShowtimes
