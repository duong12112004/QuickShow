import React, { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  CirclePause,
  FilterX,
  PenSquare,
  PlusCircle,
  Save,
  Search,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import AdminPagination from '../../components/admin/AdminPagination'
import AdminReasonModal from '../../components/admin/AdminReasonModal'
import Title from '../../components/admin/Title'
import { useAppContext } from '../../context/AppContext'

const PAGE_SIZE = 8

const roomTypeOptions = ['2D', '3D', 'IMAX', 'GOLD_CLASS', 'SWEETBOX']

const darkInputClassName = 'w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-primary'
const darkSelectClassName = 'w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-primary'
const darkOptionClassName = 'bg-slate-950 text-white'

const defaultForm = {
  name: '',
  roomType: '2D',
  status: 'ACTIVE',
  maintenanceNote: '',
}

const generateStandardMap = () => {
  const seatMap = []
  const rows = ['A', 'B', 'SPACE1', 'C', 'D', 'E', 'SPACE2', 'F', 'G']

  rows.forEach((rowLabel) => {
    if (rowLabel.startsWith('SPACE')) {
      seatMap.push({ row: rowLabel, seats: [] })
      return
    }

    const seats = []
    let type = 'STANDARD'
    if (['C', 'D', 'E'].includes(rowLabel)) type = 'VIP'
    if (['F', 'G'].includes(rowLabel)) type = 'COUPLE'

    for (let i = 1; i <= 8; i += 1) {
      if (['C', 'D', 'E', 'F', 'G'].includes(rowLabel) && i === 5) {
        seats.push({ seatNumber: `GAP-${rowLabel}`, seatType: 'EMPTY' })
      }
      seats.push({ seatNumber: `${rowLabel}${i}`, seatType: type })
    }

    seatMap.push({ row: rowLabel, seats })
  })

  return seatMap
}

const generateIMAXMap = () => {
  const seatMap = []
  const rows = ['A', 'B', 'C', 'SPACE1', 'D', 'E', 'F', 'G', 'SPACE2', 'H', 'I']

  rows.forEach((rowLabel) => {
    if (rowLabel.startsWith('SPACE')) {
      seatMap.push({ row: rowLabel, seats: [] })
      return
    }

    const seats = []
    let type = 'STANDARD'
    if (['D', 'E', 'F', 'G'].includes(rowLabel)) type = 'VIP'
    if (['H', 'I'].includes(rowLabel)) type = 'COUPLE'

    for (let i = 1; i <= 10; i += 1) {
      if (['D', 'E', 'F', 'G', 'H', 'I'].includes(rowLabel) && i === 6) {
        seats.push({ seatNumber: `GAP-${rowLabel}`, seatType: 'EMPTY' })
      }
      seats.push({ seatNumber: `${rowLabel}${i}`, seatType: type })
    }

    seatMap.push({ row: rowLabel, seats })
  })

  return seatMap
}

const generateGoldClassMap = () => {
  const seatMap = []
  const rows = ['A', 'B', 'C', 'SPACE1', 'D', 'E']

  rows.forEach((rowLabel) => {
    if (rowLabel.startsWith('SPACE')) {
      seatMap.push({ row: rowLabel, seats: [] })
      return
    }

    const seats = []
    let type = 'VIP'
    if (['D', 'E'].includes(rowLabel)) type = 'COUPLE'

    for (let i = 1; i <= 6; i += 1) {
      if (i === 4) {
        seats.push({ seatNumber: `GAP-${rowLabel}`, seatType: 'EMPTY' })
      }
      seats.push({ seatNumber: `${rowLabel}${i}`, seatType: type })
    }

    seatMap.push({ row: rowLabel, seats })
  })

  return seatMap
}

const getTemplateForRoomType = (roomType) => {
  if (roomType === 'IMAX') return 'IMAX'
  if (roomType === 'GOLD_CLASS' || roomType === 'SWEETBOX') return 'GOLD_CLASS'
  return 'STANDARD'
}

const getSeatMapFromRoomType = (roomType) => {
  const template = getTemplateForRoomType(roomType)

  if (template === 'IMAX') return generateIMAXMap()
  if (template === 'GOLD_CLASS') return generateGoldClassMap()
  return generateStandardMap()
}

const templateLabelMap = {
  STANDARD: 'Standard',
  IMAX: 'IMAX',
  GOLD_CLASS: 'Gold Class / Sweetbox',
}

const getSeatStats = (seatMap = []) => {
  const stats = {
    standard: 0,
    vip: 0,
    couple: 0,
    empty: 0,
  }

  seatMap.forEach((row) => {
    row.seats.forEach((seat) => {
      if (seat.seatType === 'STANDARD') stats.standard += 1
      if (seat.seatType === 'VIP') stats.vip += 1
      if (seat.seatType === 'COUPLE') stats.couple += 1
      if (seat.seatType === 'EMPTY') stats.empty += 1
    })
  })

  return {
    ...stats,
    capacity: stats.standard + stats.vip + stats.couple,
  }
}

const statusLabel = {
  ACTIVE: 'Active',
  MAINTENANCE: 'Bảo trì',
  INACTIVE: 'InActive',
}

const ManageRooms = () => {
  const { axios, getToken, user } = useAppContext()
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [formData, setFormData] = useState(defaultForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [statusSubmittingId, setStatusSubmittingId] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchValue, setSearchValue] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [roomTypeFilter, setRoomTypeFilter] = useState('ALL')
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [maintenanceReasonTarget, setMaintenanceReasonTarget] = useState(null)

  const fetchRooms = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get('/api/admin/rooms', {
        headers: { Authorization: `Bearer ${await getToken()}` },
      })

      if (data.success) {
        setRooms(data.rooms)
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('Không tải được danh sách phòng chiếu.')
    } finally {
      setLoading(false)
    }
  }

  const fetchRoomDetail = async (roomId) => {
    try {
      const { data } = await axios.get(`/api/admin/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      })

      if (!data.success) {
        toast.error(data.message)
        return
      }

      const room = data.room
      setSelectedRoom(room)
      setFormData({
        name: room.name,
        roomType: room.roomType,
        status: room.status || 'ACTIVE',
        maintenanceNote: room.maintenanceNote || '',
      })
      setFormModalOpen(true)
    } catch {
      toast.error('Không tải được chi tiết phòng chiếu.')
    }
  }

  useEffect(() => {
    if (user) {
      fetchRooms()
    }
  }, [user])

  const stats = useMemo(() => ({
    total: rooms.length,
    active: rooms.filter((room) => room.status === 'ACTIVE').length,
    maintenance: rooms.filter((room) => room.status === 'MAINTENANCE').length,
    inactive: rooms.filter((room) => room.status === 'INACTIVE').length,
    totalCapacity: rooms.reduce((sum, room) => sum + Number(room.capacity || 0), 0),
    futureShows: rooms.reduce((sum, room) => sum + Number(room.futureShowsCount || 0), 0),
  }), [rooms])

  const filteredRooms = useMemo(() => {
    const search = searchValue.trim().toLowerCase()

    return rooms.filter((room) => {
      const nameMatches = `${room.name || ''}`.toLowerCase().includes(search)
      const typeMatches = roomTypeFilter === 'ALL' || room.roomType === roomTypeFilter
      const statusMatches = statusFilter === 'ALL' || room.status === statusFilter

      return (!search || nameMatches) && typeMatches && statusMatches
    })
  }, [rooms, roomTypeFilter, searchValue, statusFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchValue, statusFilter, roomTypeFilter])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRooms.length / PAGE_SIZE))
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [filteredRooms.length, currentPage])

  const resetForm = () => {
    setSelectedRoom(null)
    setFormData(defaultForm)
    setFormModalOpen(false)
  }

  const openCreateForm = () => {
    setSelectedRoom(null)
    setFormData(defaultForm)
    setFormModalOpen(true)
  }

  const resetFilters = () => {
    setSearchValue('')
    setStatusFilter('ALL')
    setRoomTypeFilter('ALL')
    setCurrentPage(1)
  }

  const previewStats = useMemo(() => {
    if (!selectedRoom) {
      return getSeatStats(getSeatMapFromRoomType(formData.roomType))
    }

    return {
      capacity: selectedRoom.capacity,
      standard: selectedRoom.seatStats?.standard || 0,
      vip: selectedRoom.seatStats?.vip || 0,
      couple: selectedRoom.seatStats?.couple || 0,
      empty: selectedRoom.seatStats?.empty || 0,
    }
  }, [formData.roomType, selectedRoom])

  const totalPages = Math.max(1, Math.ceil(filteredRooms.length / PAGE_SIZE))
  const paginatedRooms = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredRooms.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredRooms, currentPage])
  const startRow = filteredRooms.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const endRow = Math.min(currentPage * PAGE_SIZE, filteredRooms.length)

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => {
      const nextForm = { ...prev, [name]: value }

      if (name === 'status' && value !== 'MAINTENANCE') {
        nextForm.maintenanceNote = ''
      }

      return nextForm
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.name.trim()) {
      return toast.error('Tên phòng chiếu là bắt buộc.')
    }

    if (formData.status === 'MAINTENANCE' && !formData.maintenanceNote.trim()) {
      return toast.error('Cần nhập lý do bảo trì.')
    }

    const payload = {
      name: formData.name.trim(),
      roomType: formData.roomType,
      status: formData.status,
      maintenanceNote: formData.status === 'MAINTENANCE' ? formData.maintenanceNote.trim() : '',
    }

    if (!selectedRoom) {
      payload.seatMap = getSeatMapFromRoomType(formData.roomType)
    }

    try {
      setSaving(true)
      const requestConfig = {
        headers: { Authorization: `Bearer ${await getToken()}` },
      }

      const { data } = selectedRoom
        ? await axios.put(`/api/admin/rooms/${selectedRoom._id}`, payload, requestConfig)
        : await axios.post('/api/admin/rooms', payload, requestConfig)

      if (!data.success) {
        toast.error(data.message)
        return
      }

      toast.success(data.message)
      resetForm()
      fetchRooms()
    } catch {
      toast.error('Không lưu được phòng chiếu.')
    } finally {
      setSaving(false)
    }
  }

  const performQuickStatusUpdate = async (room, status, maintenanceNote = '') => {
    if (status === 'MAINTENANCE' && !maintenanceNote?.trim()) {
      return toast.error('Cần nhập lý do bảo trì.')
    }

    try {
      setStatusSubmittingId(room._id)
      const { data } = await axios.patch(
        `/api/admin/rooms/${room._id}/status`,
        { status, maintenanceNote: maintenanceNote?.trim() || '' },
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      )

      if (!data.success) {
        toast.error(data.message)
        return
      }

      if (selectedRoom?._id === room._id) {
        await fetchRoomDetail(room._id)
      }

      toast.success(data.message)
      setMaintenanceReasonTarget(null)
      fetchRooms()
    } catch {
      toast.error('Không cập nhật được trạng thái phòng.')
    } finally {
      setStatusSubmittingId('')
    }
  }

  const handleQuickStatusUpdate = async (room, status) => {
    if (status === 'MAINTENANCE') {
      setMaintenanceReasonTarget(room)
      return
    }

    await performQuickStatusUpdate(room, status, '')
  }

  const submitDeleteRoom = async () => {
    if (!deleteTarget) return

    try {
      setDeletingId(deleteTarget._id)
      const { data } = await axios.delete(`/api/admin/rooms/${deleteTarget._id}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      })

      if (!data.success) {
        toast.error(data.message)
        return
      }

      if (selectedRoom?._id === deleteTarget._id) {
        resetForm()
      }

      toast.success(data.message)
      setDeleteTarget(null)
      fetchRooms()
    } catch {
      toast.error('Không xóa được phòng chiếu.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className='space-y-8'>
      <Title text1='Quản lý' text2='Phòng chiếu' />

      <div className='grid gap-4 md:grid-cols-3 xl:grid-cols-6'>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Tổng phòng</p>
          <p className='mt-2 text-2xl font-semibold text-white'>{stats.total}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Đang hoạt động</p>
          <p className='mt-2 text-2xl font-semibold text-emerald-300'>{stats.active}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Bảo trì</p>
          <p className='mt-2 text-2xl font-semibold text-amber-300'>{stats.maintenance}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Ngừng dùng</p>
          <p className='mt-2 text-2xl font-semibold text-gray-300'>{stats.inactive}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Tổng sức chứa</p>
          <p className='mt-2 text-2xl font-semibold text-primary'>{stats.totalCapacity}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Suất sắp tới</p>
          <p className='mt-2 text-2xl font-semibold text-sky-300'>{stats.futureShows}</p>
        </div>
      </div>

      <div className='rounded-2xl border border-primary/20 bg-primary/8 p-5'>
        <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
          <div>
            <h2 className='text-lg font-medium'>Bộ lọc phòng chiếu</h2>
            <p className='text-sm text-gray-400'>Tìm phòng theo tên, loại phòng và trạng thái vận hành.</p>
          </div>

          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              onClick={resetFilters}
              className='inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5'
            >
              <FilterX className='h-4 w-4' />
              Đặt lại
            </button>
            <button
              type='button'
              onClick={openCreateForm}
              className='inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20'
            >
              <PlusCircle className='h-4 w-4' />
              Tạo phòng mới
            </button>
          </div>
        </div>

        <div className='mt-5 grid gap-3 md:grid-cols-3'>
          <label className='relative block'>
            <Search className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500' />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder='Tìm theo tên phòng'
              className={`${darkInputClassName} pl-11`}
            />
          </label>

          <select
            value={roomTypeFilter}
            onChange={(event) => setRoomTypeFilter(event.target.value)}
            className={darkSelectClassName}
          >
            <option value='ALL' className={darkOptionClassName}>Tất cả loại phòng</option>
            {roomTypeOptions.map((roomType) => (
              <option key={roomType} value={roomType} className={darkOptionClassName}>{roomType}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={darkSelectClassName}
          >
            <option value='ALL' className={darkOptionClassName}>Tất cả trạng thái</option>
            <option value='ACTIVE' className={darkOptionClassName}>ACTIVE</option>
            <option value='MAINTENANCE' className={darkOptionClassName}>MAINTENANCE</option>
            <option value='INACTIVE' className={darkOptionClassName}>INACTIVE</option>
          </select>
        </div>

        <div className='mt-4 flex items-center justify-between text-xs text-gray-400'>
          <p>
            {loading
              ? 'Đang tải dữ liệu phòng chiếu...'
              : filteredRooms.length > 0
                ? `Đang hiển thị ${startRow}-${endRow} trên tổng ${filteredRooms.length} phòng`
                : 'Không có phòng phù hợp'}
          </p>
        </div>
      </div>

      <div>
        <div className='overflow-x-auto rounded-2xl border border-primary/20 bg-primary/8'>
          <table className='min-w-full text-sm'>
            <thead className='text-left text-white'>
              <tr className='border-b border-primary/20 bg-primary/12'>
                <th className='px-3 py-3 font-medium'>Phòng</th>
                <th className='px-3 py-3 font-medium'>Loại</th>
                <th className='px-3 py-3 font-medium'>Trạng thái</th>
                <th className='px-3 py-3 font-medium'>Sức chứa</th>
                <th className='px-3 py-3 font-medium'>Suất tới</th>
                <th className='px-3 py-3 font-medium text-right'>Tác vụ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className='px-3 py-8 text-center text-sm text-gray-400'>Đang tải dữ liệu phòng chiếu...</td>
                </tr>
              ) : paginatedRooms.map((room) => (
                <tr key={room._id} className='border-b border-primary/15 align-top even:bg-white/2'>
                  <td className='px-3 py-4'>
                    <p className='font-medium text-white'>{room.name}</p>
                    <p className='text-xs text-gray-500'>
                      {room.totalShowsCount > 0 ? `Đã từng có ${room.totalShowsCount} suất chiếu` : 'Chưa phát sinh suất chiếu'}
                    </p>
                  </td>
                  <td className='px-3 py-4 text-gray-300'>{room.roomType}</td>
                  <td className='px-3 py-4'>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${
                      room.status === 'ACTIVE'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : room.status === 'MAINTENANCE'
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-gray-500/15 text-gray-300'
                    }`}>
                      {statusLabel[room.status] || room.status}
                    </span>
                  </td>
                  <td className='px-3 py-4 text-gray-300'>{room.capacity} ghế</td>
                  <td className='px-3 py-4 text-gray-300'>
                    {room.futureShowsCount > 0 ? `${room.futureShowsCount} suất` : 'Không có'}
                  </td>
                  <td className='px-3 py-4'>
                    <div className='flex flex-wrap justify-end gap-2'>
                      {room.status !== 'MAINTENANCE' && (
                        <button
                          onClick={() => handleQuickStatusUpdate(room, 'MAINTENANCE')}
                          disabled={statusSubmittingId === room._id}
                          className='inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                          <Wrench className='h-3.5 w-3.5' />
                          Bảo trì
                        </button>
                      )}
                      {room.status !== 'INACTIVE' && (
                        <button
                          onClick={() => handleQuickStatusUpdate(room, 'INACTIVE')}
                          disabled={statusSubmittingId === room._id}
                          className='inline-flex items-center gap-1.5 rounded-lg border border-slate-500/30 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                          <CirclePause className='h-3.5 w-3.5' />
                          Ngừng
                        </button>
                      )}
                      {room.status !== 'ACTIVE' && (
                        <button
                          onClick={() => handleQuickStatusUpdate(room, 'ACTIVE')}
                          disabled={statusSubmittingId === room._id}
                          className='inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                          <CheckCircle2 className='h-3.5 w-3.5' />
                          Mở lại
                        </button>
                      )}
                      <button
                        onClick={() => fetchRoomDetail(room._id)}
                        className='inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 px-3 py-1.5 text-xs text-sky-300 hover:bg-sky-500/10'
                      >
                        <PenSquare className='h-3.5 w-3.5' />
                        Sửa
                      </button>
                      <button
                        disabled={deletingId === room._id || room.totalShowsCount > 0}
                        onClick={() => setDeleteTarget(room)}
                        className='inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40'
                      >
                        <Trash2 className='h-3.5 w-3.5' />
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && filteredRooms.length === 0 && (
            <div className='py-8 text-center text-sm text-gray-400'>Không có phòng chiếu phù hợp với bộ lọc hiện tại.</div>
          )}
        </div>

        <AdminPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          disabled={filteredRooms.length === 0}
        />
      </div>

      {formModalOpen && (
        <div className='fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-6'>
          <form onSubmit={handleSubmit} className='max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-primary/20 bg-slate-950 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.55)]'>
            <div className='flex items-center justify-between gap-4'>
              <div>
                <h2 className='text-lg font-medium'>{selectedRoom ? 'Cập nhật phòng' : 'Tạo phòng mới'}</h2>
                <p className='text-sm text-gray-400'>
                  {selectedRoom
                    ? 'Chỉ sửa sơ đồ ghế khi phòng không còn suất chiếu sắp tới.'
                    : 'Sơ đồ ghế sẽ tự áp theo loại phòng để tránh lệch cấu hình thực tế.'}
                </p>
              </div>
              <button
                type='button'
                onClick={resetForm}
                className='inline-flex items-center gap-2 rounded-lg border border-white/15 p-2 text-gray-300 hover:bg-white/10'
              >
                <XCircle className='h-4 w-4' />
              </button>
            </div>

          <div className='mt-5 space-y-4'>
            <div>
              <label className='mb-2 block text-sm text-gray-300'>Tên phòng</label>
              <input
                name='name'
                value={formData.name}
                onChange={handleChange}
                placeholder='VD: Cinema 7'
                className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none'
              />
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div>
                <label className='mb-2 block text-sm text-gray-300'>Loại phòng</label>
                <select
                  name='roomType'
                  value={formData.roomType}
                  onChange={handleChange}
                  disabled={selectedRoom?.canEditSeatMap === false}
                  className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <option value='2D' className='bg-slate-950 text-white'>2D</option>
                  <option value='3D' className='bg-slate-950 text-white'>3D</option>
                  <option value='IMAX' className='bg-slate-950 text-white'>IMAX</option>
                  <option value='GOLD_CLASS' className='bg-slate-950 text-white'>GOLD_CLASS</option>
                  <option value='SWEETBOX' className='bg-slate-950 text-white'>SWEETBOX</option>
                </select>
              </div>

              <div>
                <label className='mb-2 block text-sm text-gray-300'>Trạng thái</label>
                <select
                  name='status'
                  value={formData.status}
                  onChange={handleChange}
                  className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none'
                >
                  <option value='ACTIVE' className='bg-slate-950 text-white'>ACTIVE</option>
                  <option value='MAINTENANCE' className='bg-slate-950 text-white'>MAINTENANCE</option>
                  <option value='INACTIVE' className='bg-slate-950 text-white'>INACTIVE</option>
                </select>
              </div>
            </div>

            {formData.status === 'MAINTENANCE' && (
              <div>
                <label className='mb-2 block text-sm text-gray-300'>Lý do bảo trì</label>
                <textarea
                  name='maintenanceNote'
                  value={formData.maintenanceNote}
                  onChange={handleChange}
                  rows={3}
                  placeholder='VD: đổi ghế, bảo trì máy chiếu, sửa điều hòa'
                  className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none'
                />
              </div>
            )}

            {!selectedRoom && (
              <div>
                <label className='mb-2 block text-sm text-gray-300'>Template sơ đồ ghế</label>
                <div className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white'>
                  {templateLabelMap[getTemplateForRoomType(formData.roomType)]}
                </div>
                <p className='mt-2 text-xs text-gray-500'>
                  2D và 3D dùng template Standard, IMAX dùng template IMAX, GOLD_CLASS và SWEETBOX dùng template Gold Class / Sweetbox.
                </p>
              </div>
            )}
          </div>

          <div className='mt-5 rounded-2xl border border-primary/15 bg-primary/5 p-4'>
            <p className='text-sm font-medium text-white'>Preview công suất phòng</p>
            <div className='mt-3 grid grid-cols-2 gap-3 text-sm text-gray-300'>
              <div className='rounded-xl bg-black/20 p-3'>Sức chứa: <span className='text-white'>{previewStats.capacity}</span></div>
              <div className='rounded-xl bg-black/20 p-3'>Standard: <span className='text-white'>{previewStats.standard}</span></div>
              <div className='rounded-xl bg-black/20 p-3'>VIP: <span className='text-white'>{previewStats.vip}</span></div>
              <div className='rounded-xl bg-black/20 p-3'>Couple: <span className='text-white'>{previewStats.couple}</span></div>
            </div>
            <p className='mt-3 text-xs text-gray-400'>
              Ô trống trong sơ đồ được tính là khoảng đi hoặc lối lên xuống và không cộng vào sức chứa.
            </p>
            {selectedRoom?.futureShowsCount > 0 && (
              <p className='mt-2 text-xs text-amber-300'>
                Phòng này đang có {selectedRoom.futureShowsCount} suất chiếu sắp tới. Không được đổi loại phòng, sơ đồ ghế hoặc đưa vào bảo trì.
              </p>
            )}
          </div>

          <button
            type='submit'
            disabled={saving}
            className='mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {selectedRoom ? <Save className='h-4 w-4' /> : <PlusCircle className='h-4 w-4' />}
            {saving ? 'Đang xử lý...' : selectedRoom ? 'Lưu cập nhật phòng' : 'Tạo phòng chiếu'}
          </button>
        </form>
      </div>
      )}

      {maintenanceReasonTarget && (
        <AdminReasonModal
          title='Nhập lý do bảo trì phòng'
          description={`Phòng ${maintenanceReasonTarget.name} sẽ chuyển sang trạng thái bảo trì và không thể xếp suất chiếu mới.`}
          label='Lý do bảo trì'
          placeholder='VD: Bảo trì máy chiếu, thay ghế, sửa điều hòa, kiểm tra âm thanh...'
          initialValue={maintenanceReasonTarget.maintenanceNote || ''}
          confirmText='Chuyển sang bảo trì'
          variant='amber'
          isSubmitting={statusSubmittingId === maintenanceReasonTarget._id}
          onClose={() => setMaintenanceReasonTarget(null)}
          onConfirm={(reason) => performQuickStatusUpdate(maintenanceReasonTarget, 'MAINTENANCE', reason)}
        />
      )}

      {deleteTarget && (
        <div className='fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4'>
          <div className='w-full max-w-md rounded-2xl border border-red-500/20 bg-slate-950 p-6 shadow-[0_0_0_1px_rgba(239,68,68,0.1)]'>
            <div className='flex items-start gap-3'>
              <div className='mt-0.5 rounded-full bg-red-500/10 p-2 text-red-300'>
                <Trash2 className='h-5 w-5' />
              </div>
              <div>
                <h3 className='text-lg font-medium text-white'>Xác nhận xóa phòng chiếu</h3>
                <p className='mt-2 text-sm text-gray-400'>
                  Phòng này sẽ bị xóa khỏi hệ thống nếu chưa từng được gắn với suất chiếu.
                </p>
                <p className='mt-3 text-sm text-red-300'>
                  {deleteTarget.name} • {deleteTarget.roomType}
                </p>
              </div>
            </div>

            <div className='mt-6 flex justify-end gap-3'>
              <button
                onClick={() => setDeleteTarget(null)}
                className='rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/10'
              >
                Hủy
              </button>
              <button
                onClick={submitDeleteRoom}
                disabled={deletingId === deleteTarget._id}
                className='rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60'
              >
                {deletingId === deleteTarget._id ? 'Đang xóa...' : 'Xóa phòng chiếu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManageRooms
