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
  StarIcon,
  Trash2,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Loading from '../../components/Loading'
import Title from '../../components/admin/Title'
import { useAppContext } from '../../context/AppContext'
import { dateFormat, formatToDateTimeLocal, getCurrentDateTimeLocal } from '../../lib/dateFormat'

const PAGE_SIZE = 8
const DEFAULT_CLEANUP_MINUTES = 15

const defaultEditForm = {
  roomId: '',
  showDateTime: '',
  basePrice: '',
  cleanupMinutes: DEFAULT_CLEANUP_MINUTES,
}

const lifecycleLabelMap = {
  UPCOMING: 'Sap chieu',
  IN_PROGRESS: 'Dang chieu',
  ENDED: 'Da ket thuc',
  CANCELLED: 'Da huy',
}

const formatMoney = (value, currency) => `${Number(value || 0).toLocaleString()} ${currency}`

const formatDuration = (minutes) => {
  const totalMinutes = Number(minutes || 0)
  const hours = Math.floor(totalMinutes / 60)
  const remain = totalMinutes % 60

  if (!hours) return `${remain} phut`
  if (!remain) return `${hours} gio`
  return `${hours} gio ${remain} phut`
}

const normalizeDateTime = (value) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
}

const darkSelectClassName = 'w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none'
const darkOptionClassName = 'bg-slate-950 text-white'

const ManageShowtimes = () => {
  const { axios, getToken, user, image_base_url, fetchShows } = useAppContext()
  const currency = import.meta.env.VITE_CURRENCY

  const [showtimes, setShowtimes] = useState([])
  const [rooms, setRooms] = useState([])
  const [nowPlayingMovies, setNowPlayingMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  const [searchValue, setSearchValue] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dateFilter, setDateFilter] = useState('')

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [selectedMovieId, setSelectedMovieId] = useState(null)
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [createBasePrice, setCreateBasePrice] = useState('')
  const [createCleanupMinutes, setCreateCleanupMinutes] = useState(DEFAULT_CLEANUP_MINUTES)
  const [createDateTimeInput, setCreateDateTimeInput] = useState('')
  const [dateTimeSelection, setDateTimeSelection] = useState({})

  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState(defaultEditForm)
  const [editSubmitting, setEditSubmitting] = useState(false)

  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const requestConfig = async () => ({
    headers: { Authorization: `Bearer ${await getToken()}` },
  })

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
      toast.error('Khong tai duoc du lieu suat chieu.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchBootstrapData()
    }
  }, [user])

  const movieOptionsMap = new Map()

  nowPlayingMovies.forEach((movie) => {
    movieOptionsMap.set(String(movie.id), {
      _id: String(movie.id),
      title: movie.title,
      runtime: movie.runtime || 0,
      poster_path: movie.poster_path,
      release_date: movie.release_date,
      vote_average: movie.vote_average,
    })
  })

  showtimes.forEach((showtime) => {
    if (showtime.movie?._id) {
      movieOptionsMap.set(String(showtime.movie._id), {
        _id: String(showtime.movie._id),
        title: showtime.movie.title,
        runtime: showtime.runtimeMinutes || showtime.movie.runtime || 0,
        poster_path: showtime.movie.poster_path,
        release_date: showtime.movie.release_date,
        vote_average: showtime.movie.vote_average,
      })
    }
  })

  const movieOptions = Array.from(movieOptionsMap.values()).sort((a, b) => a.title.localeCompare(b.title))
  const activeRooms = rooms.filter((room) => room.status === 'ACTIVE')

  const filteredShowtimes = useMemo(() => {
    return showtimes.filter((showtime) => {
      const search = searchValue.trim().toLowerCase()
      const movieTitle = `${showtime.movie?.title || ''}`.toLowerCase()
      const roomName = `${showtime.room?.name || ''}`.toLowerCase()
      const localDate = showtime.showDateTime ? normalizeDateTime(showtime.showDateTime) : ''

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

  const selectedMovie = movieOptions.find((movie) => movie._id === String(selectedMovieId))
  const editSelectedRoom = rooms.find((room) => room._id === editForm.roomId)

  const resetFilters = () => {
    setSearchValue('')
    setStatusFilter('ALL')
    setDateFilter('')
    setCurrentPage(1)
  }

  const resetCreateForm = () => {
    setSelectedMovieId(null)
    setSelectedRoomId('')
    setCreateBasePrice('')
    setCreateCleanupMinutes(DEFAULT_CLEANUP_MINUTES)
    setCreateDateTimeInput('')
    setDateTimeSelection({})
  }

  const openCreateModal = () => {
    resetCreateForm()
    setCreateModalOpen(true)
  }

  const closeCreateModal = () => {
    setCreateModalOpen(false)
    resetCreateForm()
  }

  const handleDateTimeAdd = () => {
    if (!createDateTimeInput) return

    const [date, time] = createDateTimeInput.split('T')
    if (!date || !time) return

    setDateTimeSelection((prev) => {
      const times = prev[date] || []
      if (times.includes(time)) return prev
      return { ...prev, [date]: [...times, time].sort() }
    })
  }

  const handleRemoveTime = (date, time) => {
    setDateTimeSelection((prev) => {
      const nextTimes = (prev[date] || []).filter((item) => item !== time)
      if (nextTimes.length === 0) {
        const { [date]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [date]: nextTimes }
    })
  }

  const handleCreateSubmit = async (event) => {
    event.preventDefault()

    if (!selectedMovieId || !selectedRoomId || !createBasePrice || Object.keys(dateTimeSelection).length === 0) {
      return toast.error('Can chon phim, phong, gia ve va it nhat mot khung gio.')
    }

    try {
      setCreateSubmitting(true)
      const config = await requestConfig()
      const showsInput = Object.entries(dateTimeSelection).map(([date, time]) => ({ date, time }))

      const { data } = await axios.post('/api/admin/showtimes', {
        movieId: selectedMovieId,
        roomId: selectedRoomId,
        basePrice: Number(createBasePrice),
        cleanupMinutes: Number(createCleanupMinutes),
        showsInput,
      }, config)

      if (!data.success) {
        toast.error(data.message)
        return
      }

      toast.success(data.message)
      closeCreateModal()
      await Promise.all([fetchBootstrapData(), fetchShows()])
    } catch {
      toast.error('Khong tao duoc suat chieu.')
    } finally {
      setCreateSubmitting(false)
    }
  }

  const openEditModal = (showtime) => {
    setEditTarget(showtime)
    setEditForm({
      roomId: showtime.room?._id || '',
      showDateTime: formatToDateTimeLocal(showtime.showDateTime),
      basePrice: showtime.basePrice || '',
      cleanupMinutes: showtime.cleanupMinutes ?? DEFAULT_CLEANUP_MINUTES,
    })
  }

  const closeEditModal = () => {
    setEditTarget(null)
    setEditForm(defaultEditForm)
  }

  const handleEditChange = (event) => {
    const { name, value } = event.target
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleEditSubmit = async (event) => {
    event.preventDefault()

    if (!editTarget) return
    if (!editForm.roomId || !editForm.showDateTime || !editForm.basePrice) {
      return toast.error('Can nhap day du thong tin suat chieu.')
    }

    try {
      setEditSubmitting(true)
      const config = await requestConfig()
      const { data } = await axios.put(`/api/admin/showtimes/${editTarget._id}`, {
        movieId: editTarget.movie?._id,
        roomId: editForm.roomId,
        showDateTime: editForm.showDateTime,
        basePrice: Number(editForm.basePrice),
        cleanupMinutes: Number(editForm.cleanupMinutes),
      }, config)

      if (!data.success) {
        toast.error(data.message)
        return
      }

      toast.success(data.message)
      closeEditModal()
      await Promise.all([fetchBootstrapData(), fetchShows()])
    } catch {
      toast.error('Khong cap nhat duoc suat chieu.')
    } finally {
      setEditSubmitting(false)
    }
  }

  const submitCancelShowtime = async () => {
    if (!cancelTarget) return
    if (!cancelReason.trim()) {
      return toast.error('Can nhap ly do huy suat chieu.')
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

      toast.success(data.message)
      setCancelTarget(null)
      setCancelReason('')
      await Promise.all([fetchBootstrapData(), fetchShows()])
    } catch {
      toast.error('Khong huy duoc suat chieu.')
    } finally {
      setCancelSubmitting(false)
    }
  }

  const submitDeleteShowtime = async () => {
    if (!deleteTarget) return

    try {
      setDeleteSubmitting(true)
      const config = await requestConfig()
      const { data } = await axios.delete(`/api/admin/showtimes/${deleteTarget._id}`, config)

      if (!data.success) {
        toast.error(data.message)
        return
      }

      toast.success(data.message)
      setDeleteTarget(null)
      await Promise.all([fetchBootstrapData(), fetchShows()])
    } catch {
      toast.error('Khong xoa duoc suat chieu.')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className='space-y-8'>
      <Title text1='Quan ly' text2='Suat chieu' />

      <div className='rounded-2xl border border-white/10 bg-white/5 p-5'>
        <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
          <div>
            <h2 className='text-lg font-medium'>Danh sach suat chieu</h2>
            <p className='text-sm text-gray-400'>
              Quan ly lich chieu theo phim, phong, gia ve va trang thai van hanh.
            </p>
          </div>

          <div className='flex flex-wrap gap-2'>
            <button
              onClick={resetFilters}
              className='inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/10'
            >
              <RefreshCw className='h-4 w-4' />
              Dat lai bo loc
            </button>
            <button
              onClick={openCreateModal}
              className='inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20'
            >
              <PlusCircle className='h-4 w-4' />
              Them suat chieu
            </button>
          </div>
        </div>

        <div className='mt-5 grid gap-3 md:grid-cols-3'>
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder='Tim theo phim hoac phong'
            className='rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none'
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={darkSelectClassName}
          >
            <option value='ALL' className={darkOptionClassName}>Tat ca trang thai</option>
            <option value='UPCOMING' className={darkOptionClassName}>Sap chieu</option>
            <option value='ENDED' className={darkOptionClassName}>Da ket thuc</option>
            <option value='CANCELLED' className={darkOptionClassName}>Da huy</option>
          </select>

          <input
            type='date'
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className='rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none'
          />
        </div>

        <div className='mt-5 overflow-x-auto'>
          <table className='min-w-full text-sm'>
            <thead className='text-left text-gray-400'>
              <tr className='border-b border-white/10'>
                <th className='px-3 py-3 font-medium'>Phim</th>
                <th className='px-3 py-3 font-medium'>Phong</th>
                <th className='px-3 py-3 font-medium'>Lich chieu</th>
                <th className='px-3 py-3 font-medium'>Van hanh</th>
                <th className='px-3 py-3 font-medium'>Gia ve</th>
                <th className='px-3 py-3 font-medium'>Trang thai</th>
                <th className='px-3 py-3 font-medium'>Da ban</th>
                <th className='px-3 py-3 font-medium text-right'>Tac vu</th>
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
                  showtime.lifecycle !== 'ENDED' &&
                  !showtime.hasSales

                const canDelete =
                  (showtime.lifecycle === 'UPCOMING' || showtime.lifecycle === 'CANCELLED') &&
                  !showtime.hasSales &&
                  showtime.heldSeatCount === 0

                return (
                  <tr key={showtime._id} className='border-b border-white/5'>
                    <td className='px-3 py-4'>
                      <p className='font-medium text-white'>{showtime.movie?.title}</p>
                      <p className='text-xs text-gray-500'>
                        {showtime.movie?.release_date ? `Khoi chieu phim: ${showtime.movie.release_date}` : 'Phim TMDB'}
                      </p>
                    </td>
                    <td className='px-3 py-4 text-gray-300'>
                      <p>{showtime.room?.name}</p>
                      <p className='text-xs text-gray-500'>{showtime.room?.roomType}</p>
                    </td>
                    <td className='px-3 py-4 text-gray-300'>
                      <p>{dateFormat(showtime.showDateTime)}</p>
                      <p className='text-xs text-gray-500'>Ket thuc: {dateFormat(showtime.endDateTime)}</p>
                    </td>
                    <td className='px-3 py-4 text-gray-300'>
                      <p>{formatDuration(showtime.runtimeMinutes)}</p>
                      <p className='text-xs text-gray-500'>Don phong: {formatDuration(showtime.cleanupMinutes)}</p>
                    </td>
                    <td className='px-3 py-4 text-gray-300'>{formatMoney(showtime.basePrice, currency)}</td>
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
                    </td>
                    <td className='px-3 py-4 text-gray-300'>
                      <p>{showtime.soldSeatCount} ghe</p>
                      {showtime.heldSeatCount > 0 && (
                        <p className='text-xs text-amber-300'>Giu cho: {showtime.heldSeatCount}</p>
                      )}
                    </td>
                    <td className='px-3 py-4'>
                      <div className='flex flex-wrap justify-end gap-2'>
                        <button
                          onClick={() => openEditModal(showtime)}
                          disabled={!canEdit}
                          className='inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 px-3 py-1.5 text-xs text-sky-300 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-40'
                        >
                          <PenSquare className='h-3.5 w-3.5' />
                          Sua
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
                          Huy
                        </button>
                        <button
                          onClick={() => setDeleteTarget(showtime)}
                          disabled={!canDelete}
                          className='inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40'
                        >
                          <Trash2 className='h-3.5 w-3.5' />
                          Xoa
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!loading && filteredShowtimes.length === 0 && (
            <div className='py-8 text-center text-sm text-gray-400'>Chua co suat chieu phu hop voi bo loc.</div>
          )}
        </div>

        {filteredShowtimes.length > 0 && (
          <div className='mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 md:flex-row md:items-center md:justify-between'>
            <p className='text-sm text-gray-400'>
              Hien thi {startRow}-{endRow} tren tong {filteredShowtimes.length} suat chieu
            </p>

            <div className='flex items-center gap-2 self-end md:self-auto'>
              <button
                type='button'
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className='inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40'
              >
                <ChevronLeft className='h-4 w-4' />
                Truoc
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

      {createModalOpen && (
        <div className='fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-6'>
          <div className='max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <h3 className='text-xl font-medium text-white'>Them suat chieu</h3>
                <p className='mt-1 text-sm text-gray-400'>
                  Chon phim dang chieu tu TMDB, chon phong va them nhieu khung gio trong mot lan.
                </p>
              </div>
              <button
                onClick={closeCreateModal}
                className='rounded-lg border border-white/10 p-2 text-gray-300 hover:bg-white/10'
              >
                <XCircle className='h-4 w-4' />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <p className='mt-6 text-sm font-medium text-white'>Danh sach phim dang chieu</p>
              <div className='mt-4 overflow-x-auto pb-4'>
                <div className='flex w-max gap-4'>
                  {nowPlayingMovies.map((movie) => (
                    <button
                      type='button'
                      key={movie.id}
                      onClick={() => setSelectedMovieId(String(movie.id))}
                      className={`w-40 shrink-0 text-left transition ${
                        String(selectedMovieId) === String(movie.id) ? 'scale-[1.02]' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className={`overflow-hidden rounded-xl border ${
                        String(selectedMovieId) === String(movie.id)
                          ? 'border-primary shadow-[0_0_0_1px_rgba(255,85,102,0.4)]'
                          : 'border-white/10'
                      } bg-white/5`}>
                        <img
                          src={movie.poster_path ? image_base_url + movie.poster_path : ''}
                          alt={movie.title}
                          className='h-56 w-full object-cover'
                        />
                        <div className='space-y-1 p-3'>
                          <p className='line-clamp-2 font-medium text-white'>{movie.title}</p>
                          <p className='flex items-center gap-1 text-xs text-gray-400'>
                            <StarIcon className='h-3.5 w-3.5 text-primary fill-primary' />
                            {movie.vote_average ? movie.vote_average.toFixed(1) : '0.0'}
                          </p>
                          <p className='text-xs text-gray-500'>Khoi chieu: {movie.release_date}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className='mt-6 grid gap-4 lg:grid-cols-3'>
                <div>
                  <label className='mb-2 block text-sm text-gray-300'>Phong chieu</label>
                  <select
                    value={selectedRoomId}
                    onChange={(event) => setSelectedRoomId(event.target.value)}
                    className={darkSelectClassName}
                  >
                    <option value='' className={darkOptionClassName}>Chon phong</option>
                    {activeRooms.map((room) => (
                      <option key={room._id} value={room._id} className={darkOptionClassName}>
                        {room.name} ({room.roomType} - {room.capacity} ghe)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className='mb-2 block text-sm text-gray-300'>Gia ve co ban</label>
                  <input
                    type='number'
                    min='1000'
                    step='1000'
                    value={createBasePrice}
                    onChange={(event) => setCreateBasePrice(event.target.value)}
                    placeholder='85000'
                    className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none'
                  />
                </div>

                <div>
                  <label className='mb-2 block text-sm text-gray-300'>Don phong sau suat (phut)</label>
                  <input
                    type='number'
                    min='0'
                    max='90'
                    value={createCleanupMinutes}
                    onChange={(event) => setCreateCleanupMinutes(event.target.value)}
                    className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none'
                  />
                </div>
              </div>

              <div className='mt-6'>
                <label className='mb-2 block text-sm text-gray-300'>Them khung gio</label>
                <div className='flex flex-col gap-3 md:flex-row'>
                  <input
                    type='datetime-local'
                    min={getCurrentDateTimeLocal()}
                    value={createDateTimeInput}
                    onChange={(event) => setCreateDateTimeInput(event.target.value)}
                    className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none'
                  />
                  <button
                    type='button'
                    onClick={handleDateTimeAdd}
                    className='inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90'
                  >
                    <CalendarPlus className='h-4 w-4' />
                    Them lich
                  </button>
                </div>
              </div>

              {Object.keys(dateTimeSelection).length > 0 && (
                <div className='mt-6 rounded-2xl border border-white/10 bg-white/5 p-4'>
                  <p className='text-sm font-medium text-white'>Cac moc da chon</p>
                  <div className='mt-3 space-y-3'>
                    {Object.entries(dateTimeSelection).map(([date, times]) => (
                      <div key={date}>
                        <p className='text-sm text-gray-300'>{date}</p>
                        <div className='mt-2 flex flex-wrap gap-2'>
                          {times.map((time) => (
                            <div
                              key={time}
                              className='inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-white'
                            >
                              {time}
                              <button
                                type='button'
                                onClick={() => handleRemoveTime(date, time)}
                                className='text-red-300 hover:text-red-200'
                              >
                                <XCircle className='h-4 w-4' />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className='mt-6 rounded-2xl border border-primary/15 bg-primary/5 p-4'>
                <p className='text-sm font-medium text-white'>Tom tat</p>
                <div className='mt-3 space-y-2 text-sm text-gray-300'>
                  <p>Phim: <span className='text-white'>{selectedMovie?.title || 'Chua chon'}</span></p>
                  <p>Runtime: <span className='text-white'>{selectedMovie?.runtime ? formatDuration(selectedMovie.runtime) : 'Lay tu du lieu phim'}</span></p>
                  <p>So moc chieu: <span className='text-white'>{Object.values(dateTimeSelection).reduce((sum, times) => sum + times.length, 0)}</span></p>
                </div>
              </div>

              <div className='mt-6 flex justify-end gap-3'>
                <button
                  type='button'
                  onClick={closeCreateModal}
                  className='rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/10'
                >
                  Dong
                </button>
                <button
                  type='submit'
                  disabled={createSubmitting}
                  className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  <PlusCircle className='h-4 w-4' />
                  {createSubmitting ? 'Dang tao...' : 'Tao suat chieu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className='fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-6'>
          <div className='w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950 p-6'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <h3 className='text-xl font-medium text-white'>Cap nhat suat chieu</h3>
                <p className='mt-1 text-sm text-gray-400'>
                  Phim duoc giu nguyen. Chi sua phong, gio chieu, gia ve va thoi gian don phong.
                </p>
              </div>
              <button
                onClick={closeEditModal}
                className='rounded-lg border border-white/10 p-2 text-gray-300 hover:bg-white/10'
              >
                <XCircle className='h-4 w-4' />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className='mt-6 space-y-4'>
              <div>
                <label className='mb-2 block text-sm text-gray-300'>Phim</label>
                <div className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white'>
                  {editTarget.movie?.title || 'Khong co du lieu'}
                </div>
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
                <div>
                  <label className='mb-2 block text-sm text-gray-300'>Phong chieu</label>
                  <select
                    name='roomId'
                    value={editForm.roomId}
                    onChange={handleEditChange}
                    className={darkSelectClassName}
                  >
                    <option value='' className={darkOptionClassName}>Chon phong</option>
                    {rooms.map((room) => (
                      <option key={room._id} value={room._id} className={darkOptionClassName}>
                        {room.name} ({room.roomType} - {room.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className='mb-2 block text-sm text-gray-300'>Gio chieu</label>
                  <input
                    type='datetime-local'
                    min={getCurrentDateTimeLocal()}
                    name='showDateTime'
                    value={editForm.showDateTime}
                    onChange={handleEditChange}
                    className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none'
                  />
                </div>
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
                <div>
                  <label className='mb-2 block text-sm text-gray-300'>Gia ve co ban</label>
                  <input
                    type='number'
                    min='1000'
                    step='1000'
                    name='basePrice'
                    value={editForm.basePrice}
                    onChange={handleEditChange}
                    className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none'
                  />
                </div>

                <div>
                  <label className='mb-2 block text-sm text-gray-300'>Don phong sau suat (phut)</label>
                  <input
                    type='number'
                    min='0'
                    max='90'
                    name='cleanupMinutes'
                    value={editForm.cleanupMinutes}
                    onChange={handleEditChange}
                    className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none'
                  />
                </div>
              </div>

              <div className='rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300'>
                <p>Runtime: <span className='text-white'>{editTarget.runtimeMinutes ? formatDuration(editTarget.runtimeMinutes) : 'Lay tu du lieu phim'}</span></p>
                {editSelectedRoom && (
                  <p className='mt-2'>Phong: <span className='text-white'>{editSelectedRoom.name} • {editSelectedRoom.roomType}</span></p>
                )}
              </div>

              <div className='flex justify-end gap-3'>
                <button
                  type='button'
                  onClick={closeEditModal}
                  className='rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/10'
                >
                  Dong
                </button>
                <button
                  type='submit'
                  disabled={editSubmitting}
                  className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  <Save className='h-4 w-4' />
                  {editSubmitting ? 'Dang luu...' : 'Luu cap nhat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className='fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4'>
          <div className='w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-6'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <h3 className='text-lg font-medium text-white'>Huy suat chieu</h3>
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
              <label className='mb-2 block text-sm text-gray-300'>Ly do huy</label>
              <textarea
                rows={4}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder='VD: bao tri dot xuat, doi lich phat hanh, loi ky thuat...'
                className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none'
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
                Dong
              </button>
              <button
                onClick={submitCancelShowtime}
                disabled={cancelSubmitting}
                className='rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60'
              >
                {cancelSubmitting ? 'Dang huy...' : 'Xac nhan huy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className='fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4'>
          <div className='w-full max-w-md rounded-2xl border border-red-500/20 bg-slate-950 p-6 shadow-[0_0_0_1px_rgba(239,68,68,0.1)]'>
            <div className='flex items-start gap-3'>
              <div className='mt-0.5 rounded-full bg-red-500/10 p-2 text-red-300'>
                <Trash2 className='h-5 w-5' />
              </div>
              <div>
                <h3 className='text-lg font-medium text-white'>Xac nhan xoa suat chieu</h3>
                <p className='mt-2 text-sm text-gray-400'>
                  Suat chieu nay se bi xoa khoi he thong neu chua co ve ban ra hoac ghe dang giu.
                </p>
                <p className='mt-3 text-sm text-red-300'>
                  {deleteTarget.movie?.title} • {dateFormat(deleteTarget.showDateTime)}
                </p>
              </div>
            </div>

            <div className='mt-6 flex justify-end gap-3'>
              <button
                onClick={() => setDeleteTarget(null)}
                className='rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/10'
              >
                Huy
              </button>
              <button
                onClick={submitDeleteShowtime}
                disabled={deleteSubmitting}
                className='rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60'
              >
                {deleteSubmitting ? 'Dang xoa...' : 'Xoa suat chieu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManageShowtimes
