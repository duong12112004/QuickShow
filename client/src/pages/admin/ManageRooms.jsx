import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import Title from '../../components/admin/Title'
import { useAppContext } from '../../context/AppContext'

const defaultForm = {
  name: '',
  roomType: '2D',
  status: 'ACTIVE',
  maintenanceNote: '',
  layoutTemplate: 'STANDARD',
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

const getSeatMapFromTemplate = (template) => {
  if (template === 'IMAX') return generateIMAXMap()
  if (template === 'GOLD_CLASS') return generateGoldClassMap()
  return generateStandardMap()
}

const inferTemplateFromRoomType = (roomType) => {
  if (roomType === 'IMAX') return 'IMAX'
  if (roomType === 'GOLD_CLASS' || roomType === 'SWEETBOX') return 'GOLD_CLASS'
  return 'STANDARD'
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
  ACTIVE: 'Dang khai thac',
  MAINTENANCE: 'Bao tri',
  INACTIVE: 'Ngung khai thac',
}

const ManageRooms = () => {
  const { axios, getToken, user } = useAppContext()
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [formData, setFormData] = useState(defaultForm)
  const [replaceSeatMap, setReplaceSeatMap] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')

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
    } catch (error) {
      toast.error('Khong tai duoc danh sach phong chieu.')
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
        layoutTemplate: inferTemplateFromRoomType(room.roomType),
      })
      setReplaceSeatMap(false)
    } catch (error) {
      toast.error('Khong tai duoc chi tiet phong chieu.')
    }
  }

  useEffect(() => {
    if (user) {
      fetchRooms()
    }
  }, [user])

  const resetForm = () => {
    setSelectedRoom(null)
    setFormData(defaultForm)
    setReplaceSeatMap(true)
  }

  const previewStats = useMemo(() => {
    if (!selectedRoom || replaceSeatMap) {
      return getSeatStats(getSeatMapFromTemplate(formData.layoutTemplate))
    }

    return {
      capacity: selectedRoom.capacity,
      standard: selectedRoom.seatStats?.standard || 0,
      vip: selectedRoom.seatStats?.vip || 0,
      couple: selectedRoom.seatStats?.couple || 0,
      empty: selectedRoom.seatStats?.empty || 0,
    }
  }, [formData.layoutTemplate, replaceSeatMap, selectedRoom])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.name.trim()) {
      return toast.error('Ten phong chieu la bat buoc.')
    }

    if (formData.status === 'MAINTENANCE' && !formData.maintenanceNote.trim()) {
      return toast.error('Can nhap ly do bao tri.')
    }

    const payload = {
      name: formData.name.trim(),
      roomType: formData.roomType,
      status: formData.status,
      maintenanceNote: formData.status === 'MAINTENANCE' ? formData.maintenanceNote.trim() : '',
    }

    if (!selectedRoom || replaceSeatMap) {
      payload.seatMap = getSeatMapFromTemplate(formData.layoutTemplate)
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
    } catch (error) {
      toast.error('Khong luu duoc phong chieu.')
    } finally {
      setSaving(false)
    }
  }

  const handleQuickStatusUpdate = async (room, status) => {
    try {
      const maintenanceNote = status === 'MAINTENANCE'
        ? window.prompt('Nhap ly do bao tri cho phong nay:', room.maintenanceNote || '')
        : ''

      if (status === 'MAINTENANCE' && !maintenanceNote?.trim()) {
        return toast.error('Can nhap ly do bao tri.')
      }

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
      fetchRooms()
    } catch (error) {
      toast.error('Khong cap nhat duoc trang thai phong.')
    }
  }

  const handleDelete = async (room) => {
    const confirmed = window.confirm(`Xoa phong ${room.name}?`)
    if (!confirmed) return

    try {
      setDeletingId(room._id)
      const { data } = await axios.delete(`/api/admin/rooms/${room._id}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      })

      if (!data.success) {
        toast.error(data.message)
        return
      }

      if (selectedRoom?._id === room._id) {
        resetForm()
      }

      toast.success(data.message)
      fetchRooms()
    } catch (error) {
      toast.error('Khong xoa duoc phong chieu.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className='space-y-8'>
      <Title text1='Quan ly' text2='Phong chieu' />

      <div className='grid gap-6 xl:grid-cols-[1.2fr_0.8fr]'>
        <div className='rounded-2xl border border-white/10 bg-white/5 p-5'>
          <div className='flex items-center justify-between gap-4'>
            <div>
              <h2 className='text-lg font-medium'>Danh sach phong</h2>
              <p className='text-sm text-gray-400'>Trang thai, suc chua va rang buoc khai thac cua tung phong.</p>
            </div>
            <button
              onClick={resetForm}
              className='rounded-lg border border-primary/40 px-4 py-2 text-sm text-primary hover:bg-primary/10'
            >
              Tao phong moi
            </button>
          </div>

          <div className='mt-5 overflow-x-auto'>
            <table className='min-w-full text-sm'>
              <thead className='text-left text-gray-400'>
                <tr className='border-b border-white/10'>
                  <th className='px-3 py-3 font-medium'>Phong</th>
                  <th className='px-3 py-3 font-medium'>Loai</th>
                  <th className='px-3 py-3 font-medium'>Trang thai</th>
                  <th className='px-3 py-3 font-medium'>Suc chua</th>
                  <th className='px-3 py-3 font-medium'>Suat toi</th>
                  <th className='px-3 py-3 font-medium text-right'>Tac vu</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room._id} className='border-b border-white/5'>
                    <td className='px-3 py-4'>
                      <p className='font-medium text-white'>{room.name}</p>
                      <p className='text-xs text-gray-500'>
                        {room.totalShowsCount > 0 ? `Da tung co ${room.totalShowsCount} suat chieu` : 'Chua phat sinh suat chieu'}
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
                    <td className='px-3 py-4 text-gray-300'>{room.capacity} ghe</td>
                    <td className='px-3 py-4 text-gray-300'>
                      {room.futureShowsCount > 0 ? `${room.futureShowsCount} suat` : 'Khong co'}
                    </td>
                    <td className='px-3 py-4'>
                      <div className='flex flex-wrap justify-end gap-2'>
                        <button
                          onClick={() => fetchRoomDetail(room._id)}
                          className='rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10'
                        >
                          Sua
                        </button>
                        {room.status !== 'MAINTENANCE' && (
                          <button
                            onClick={() => handleQuickStatusUpdate(room, 'MAINTENANCE')}
                            className='rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10'
                          >
                            Bao tri
                          </button>
                        )}
                        {room.status !== 'INACTIVE' && (
                          <button
                            onClick={() => handleQuickStatusUpdate(room, 'INACTIVE')}
                            className='rounded-lg border border-gray-500/30 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-500/10'
                          >
                            Ngung
                          </button>
                        )}
                        {room.status !== 'ACTIVE' && (
                          <button
                            onClick={() => handleQuickStatusUpdate(room, 'ACTIVE')}
                            className='rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10'
                          >
                            Mo lai
                          </button>
                        )}
                        <button
                          disabled={deletingId === room._id || room.totalShowsCount > 0}
                          onClick={() => handleDelete(room)}
                          className='rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40'
                        >
                          Xoa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && rooms.length === 0 && (
              <div className='py-8 text-center text-sm text-gray-400'>Chua co phong chieu nao.</div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className='rounded-2xl border border-white/10 bg-white/5 p-5'>
          <div className='flex items-center justify-between gap-4'>
            <div>
              <h2 className='text-lg font-medium'>{selectedRoom ? 'Cap nhat phong' : 'Tao phong moi'}</h2>
              <p className='text-sm text-gray-400'>
                {selectedRoom
                  ? 'Chi sua so do ghe khi phong khong con suat chieu sap toi.'
                  : 'Khoi tao phong tu template de dam bao seat map dung chuan.'}
              </p>
            </div>
            {selectedRoom && (
              <button
                type='button'
                onClick={resetForm}
                className='rounded-lg border border-white/15 px-3 py-2 text-xs text-gray-300 hover:bg-white/10'
              >
                Bo chon
              </button>
            )}
          </div>

          <div className='mt-5 space-y-4'>
            <div>
              <label className='mb-2 block text-sm text-gray-300'>Ten phong</label>
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
                <label className='mb-2 block text-sm text-gray-300'>Loai phong</label>
                <select
                  name='roomType'
                  value={formData.roomType}
                  onChange={handleChange}
                  disabled={selectedRoom?.canEditSeatMap === false}
                  className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <option value='2D'>2D</option>
                  <option value='3D'>3D</option>
                  <option value='IMAX'>IMAX</option>
                  <option value='GOLD_CLASS'>GOLD_CLASS</option>
                  <option value='SWEETBOX'>SWEETBOX</option>
                </select>
              </div>

              <div>
                <label className='mb-2 block text-sm text-gray-300'>Trang thai</label>
                <select
                  name='status'
                  value={formData.status}
                  onChange={handleChange}
                  className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none'
                >
                  <option value='ACTIVE'>ACTIVE</option>
                  <option value='MAINTENANCE'>MAINTENANCE</option>
                  <option value='INACTIVE'>INACTIVE</option>
                </select>
              </div>
            </div>

            {formData.status === 'MAINTENANCE' && (
              <div>
                <label className='mb-2 block text-sm text-gray-300'>Ly do bao tri</label>
                <textarea
                  name='maintenanceNote'
                  value={formData.maintenanceNote}
                  onChange={handleChange}
                  rows={3}
                  placeholder='VD: doi ghe, bao tri may chieu, sua dieu hoa'
                  className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none'
                />
              </div>
            )}

            {selectedRoom && (
              <label className='flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300'>
                <input
                  type='checkbox'
                  checked={replaceSeatMap}
                  disabled={!selectedRoom.canEditSeatMap}
                  onChange={(event) => setReplaceSeatMap(event.target.checked)}
                />
                Cap nhat lai so do ghe theo template
              </label>
            )}

            {(!selectedRoom || replaceSeatMap) && (
              <div>
                <label className='mb-2 block text-sm text-gray-300'>Template so do ghe</label>
                <select
                  name='layoutTemplate'
                  value={formData.layoutTemplate}
                  onChange={handleChange}
                  className='w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none'
                >
                  <option value='STANDARD'>Standard</option>
                  <option value='IMAX'>IMAX</option>
                  <option value='GOLD_CLASS'>Gold Class / Sweetbox</option>
                </select>
              </div>
            )}
          </div>

          <div className='mt-5 rounded-2xl border border-primary/15 bg-primary/5 p-4'>
            <p className='text-sm font-medium text-white'>Preview cong suat phong</p>
            <div className='mt-3 grid grid-cols-2 gap-3 text-sm text-gray-300'>
              <div className='rounded-xl bg-black/20 p-3'>Suc chua: <span className='text-white'>{previewStats.capacity}</span></div>
              <div className='rounded-xl bg-black/20 p-3'>Standard: <span className='text-white'>{previewStats.standard}</span></div>
              <div className='rounded-xl bg-black/20 p-3'>VIP: <span className='text-white'>{previewStats.vip}</span></div>
              <div className='rounded-xl bg-black/20 p-3'>Couple: <span className='text-white'>{previewStats.couple}</span></div>
            </div>
            <p className='mt-3 text-xs text-gray-400'>
              O trong so do duoc tinh la khoang di/loi len xuong va khong cong vao suc chua.
            </p>
            {selectedRoom?.futureShowsCount > 0 && (
              <p className='mt-2 text-xs text-amber-300'>
                Phong nay dang co {selectedRoom.futureShowsCount} suat chieu sap toi. Khong duoc doi loai phong, so do ghe hoac dua vao bao tri.
              </p>
            )}
          </div>

          <button
            type='submit'
            disabled={saving}
            className='mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {saving ? 'Dang xu ly...' : selectedRoom ? 'Luu cap nhat phong' : 'Tao phong chieu'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ManageRooms
