import React, { useEffect } from 'react'
import {
  Armchair,
  CalendarClock,
  CirclePause,
  Clock3,
  Coins,
  DoorOpen,
  Gauge,
  PenSquare,
  Star,
  TicketCheck,
  Trash2,
  UsersRound,
  XCircle,
} from 'lucide-react'
import { dateFormat } from '../../lib/dateFormat'

const lifecycleUi = {
  UPCOMING: { label: 'Sắp chiếu', className: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' },
  IN_PROGRESS: { label: 'Đang chiếu', className: 'border-sky-400/30 bg-sky-500/15 text-sky-300' },
  ENDED: { label: 'Đã kết thúc', className: 'border-slate-400/30 bg-slate-500/15 text-slate-300' },
  CANCELLED: { label: 'Đã hủy', className: 'border-rose-400/30 bg-rose-500/15 text-rose-300' },
}

const formatMoney = (value, currency) => `${Number(value || 0).toLocaleString('vi-VN')} ${currency}`

const formatDuration = (minutes) => {
  const totalMinutes = Number(minutes || 0)
  const hours = Math.floor(totalMinutes / 60)
  const remain = totalMinutes % 60

  if (!hours) return `${remain} phút`
  if (!remain) return `${hours} giờ`
  return `${hours} giờ ${remain} phút`
}

const DetailItem = ({ label, value, valueClassName = 'text-gray-100' }) => (
  <div className='rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3'>
    <p className='text-xs uppercase tracking-[0.14em] text-gray-500'>{label}</p>
    <p className={`mt-1.5 break-words text-sm font-medium ${valueClassName}`}>{value ?? 'Chưa có dữ liệu'}</p>
  </div>
)

const Section = ({ icon, iconClassName, title, description, children }) => (
  <section className='rounded-2xl border border-white/10 bg-white/[0.025] p-4'>
    <div className='mb-4 flex items-start gap-3'>
      <div className={`rounded-xl border p-2 ${iconClassName}`}>
        {React.createElement(icon, { className: 'h-4 w-4' })}
      </div>
      <div>
        <h3 className='font-semibold text-white'>{title}</h3>
        {description && <p className='mt-0.5 text-xs text-gray-500'>{description}</p>}
      </div>
    </div>
    {children}
  </section>
)

const ShowtimeDetailsModal = ({
  showtime,
  currency,
  imageBaseUrl,
  onClose,
  onEdit,
  onCancel,
  onDelete,
}) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (!showtime) return null

  const movie = showtime.movie || {}
  const room = showtime.room || {}
  const lifecycle = lifecycleUi[showtime.lifecycle] || {
    label: showtime.lifecycle || 'Không rõ',
    className: 'border-slate-400/30 bg-slate-500/15 text-slate-300',
  }
  const capacity = Number(room.capacity || 0)
  const soldSeats = Number(showtime.soldSeatCount || 0)
  const heldSeats = Number(showtime.heldSeatCount || 0)
  const remainingSeats = Math.max(capacity - soldSeats - heldSeats, 0)
  const occupancyRate = capacity > 0 ? Math.min(Math.round((soldSeats / capacity) * 100), 100) : 0
  const canEdit = showtime.lifecycle === 'UPCOMING'
    && showtime.status === 'SCHEDULED'
    && !showtime.hasSales
    && heldSeats === 0
  const canCancel = showtime.status === 'SCHEDULED' && showtime.lifecycle !== 'ENDED'
  const canDelete = ['UPCOMING', 'CANCELLED'].includes(showtime.lifecycle)
    && !showtime.hasSales
    && heldSeats === 0
  const genres = (movie.genresVi?.length ? movie.genresVi : movie.genres || [])
    .map((genre) => genre?.name || genre)
    .filter(Boolean)

  return (
    <div
      className='fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-3 py-5 backdrop-blur-sm sm:px-6'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role='dialog'
      aria-modal='true'
      aria-labelledby='showtime-detail-title'
    >
      <div className='max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-sky-400/20 bg-slate-950 shadow-[0_30px_120px_rgba(0,0,0,0.7)]'>
        <div className='sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur-xl sm:px-6'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <div className='flex flex-wrap items-center gap-2'>
                <h2 id='showtime-detail-title' className='text-xl font-bold text-white'>Chi tiết suất chiếu</h2>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${lifecycle.className}`}>{lifecycle.label}</span>
              </div>
              <p className='mt-2 text-sm text-gray-400'>
                {room.name || 'Chưa có phòng'} · {showtime.showDateTime ? dateFormat(showtime.showDateTime) : 'Chưa có lịch chiếu'}
              </p>
            </div>
            <button type='button' onClick={onClose} className='rounded-xl border border-white/15 p-2 text-gray-300 transition hover:bg-white/10 hover:text-white' aria-label='Đóng chi tiết suất chiếu'>
              <XCircle className='h-5 w-5' />
            </button>
          </div>
        </div>

        <div className='space-y-5 p-4 sm:p-6'>
          <div className='overflow-hidden rounded-2xl border border-sky-400/20 bg-gradient-to-r from-sky-500/15 via-white/[0.03] to-transparent'>
            <div className='flex flex-col gap-5 p-5 sm:flex-row sm:items-center'>
              {movie.poster_path ? (
                <img src={imageBaseUrl + movie.poster_path} alt={movie.title} className='h-36 w-24 shrink-0 rounded-2xl object-cover shadow-xl' />
              ) : (
                <div className='flex h-36 w-24 shrink-0 items-center justify-center rounded-2xl bg-black/30 text-xs text-gray-500'>No poster</div>
              )}
              <div className='min-w-0 flex-1'>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-sky-300'>Thông tin phim</p>
                <h3 className='mt-2 text-2xl font-bold text-white'>{movie.title || 'Phim không xác định'}</h3>
                <div className='mt-3 flex flex-wrap gap-2'>
                  {genres.slice(0, 5).map((genre) => (
                    <span key={genre} className='rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300'>{genre}</span>
                  ))}
                </div>
                <div className='mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-300'>
                  <span className='inline-flex items-center gap-2'><Clock3 className='h-4 w-4 text-violet-300' />{formatDuration(showtime.runtimeMinutes)}</span>
                  <span className='inline-flex items-center gap-2'><Star className='h-4 w-4 text-amber-300' />{Number(movie.vote_average || 0).toFixed(1)}</span>
                  {movie.certification && <span className='font-medium text-rose-200'>{movie.certification}</span>}
                </div>
              </div>
              <div className='rounded-2xl border border-emerald-400/25 bg-black/20 px-5 py-4 sm:text-right'>
                <p className='text-xs uppercase tracking-[0.16em] text-gray-500'>Doanh thu</p>
                <p className='mt-2 text-2xl font-bold text-emerald-300'>{formatMoney(showtime.totalEarnings, currency)}</p>
                <p className='mt-1 text-xs text-gray-500'>{showtime.paidBookings || 0} booking đã thanh toán</p>
              </div>
            </div>
          </div>

          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
            <DetailItem label='Giá vé cơ bản' value={formatMoney(showtime.basePrice, currency)} valueClassName='text-sky-200' />
            <DetailItem label='Ghế đã bán' value={`${soldSeats} ghế`} valueClassName='text-emerald-300' />
            <DetailItem label='Ghế đang giữ' value={`${heldSeats} ghế`} valueClassName={heldSeats > 0 ? 'text-amber-300' : 'text-gray-100'} />
            <DetailItem label='Tỷ lệ lấp đầy' value={`${occupancyRate}%`} valueClassName='text-violet-300' />
          </div>

          <div className='grid gap-5 lg:grid-cols-2'>
            <Section icon={CalendarClock} iconClassName='border-violet-400/25 bg-violet-500/10 text-violet-300' title='Lịch vận hành' description='Khung giờ chiếu và thời gian chuẩn bị phòng'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <DetailItem label='Bắt đầu' value={showtime.showDateTime ? dateFormat(showtime.showDateTime) : null} />
                <DetailItem label='Kết thúc vận hành' value={showtime.endDateTime ? dateFormat(showtime.endDateTime) : null} />
                <DetailItem label='Thời lượng phim' value={formatDuration(showtime.runtimeMinutes)} />
                <DetailItem label='Thời gian dọn phòng' value={formatDuration(showtime.cleanupMinutes)} />
              </div>
            </Section>

            <Section icon={DoorOpen} iconClassName='border-cyan-400/25 bg-cyan-500/10 text-cyan-300' title='Phòng chiếu' description='Cấu hình phòng áp dụng cho suất chiếu'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <DetailItem label='Tên phòng' value={room.name} />
                <DetailItem label='Loại phòng' value={room.roomType} />
                <DetailItem label='Sức chứa' value={`${capacity} ghế`} />
                <DetailItem label='Trạng thái phòng' value={room.status} />
              </div>
              {room.maintenanceNote && <p className='mt-3 rounded-xl border border-amber-400/20 bg-amber-500/8 p-3 text-sm text-amber-100'>{room.maintenanceNote}</p>}
            </Section>
          </div>

          <div className='grid gap-5 lg:grid-cols-[1.2fr_0.8fr]'>
            <Section icon={Armchair} iconClassName='border-sky-400/25 bg-sky-500/10 text-sky-300' title='Tình trạng ghế' description='Phân bổ ghế theo trạng thái hiện tại'>
              <div className='mb-4 h-3 overflow-hidden rounded-full bg-white/5'>
                <div className='h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all' style={{ width: `${occupancyRate}%` }} />
              </div>
              <div className='grid gap-3 sm:grid-cols-3'>
                <DetailItem label='Đã bán' value={soldSeats} valueClassName='text-emerald-300' />
                <DetailItem label='Đang giữ' value={heldSeats} valueClassName='text-amber-300' />
                <DetailItem label='Còn trống' value={remainingSeats} valueClassName='text-sky-300' />
              </div>
            </Section>

            <Section icon={Gauge} iconClassName='border-emerald-400/25 bg-emerald-500/10 text-emerald-300' title='Hiệu suất kinh doanh' description='Tổng hợp booking đã thanh toán'>
              <div className='space-y-3'>
                <div className='flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] p-3 text-sm'>
                  <span className='inline-flex items-center gap-2 text-gray-400'><TicketCheck className='h-4 w-4 text-sky-300' />Booking thanh toán</span>
                  <strong className='text-white'>{showtime.paidBookings || 0}</strong>
                </div>
                <div className='flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] p-3 text-sm'>
                  <span className='inline-flex items-center gap-2 text-gray-400'><UsersRound className='h-4 w-4 text-violet-300' />Vé đã bán</span>
                  <strong className='text-white'>{soldSeats}</strong>
                </div>
                <div className='flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] p-3 text-sm'>
                  <span className='inline-flex items-center gap-2 text-gray-400'><Coins className='h-4 w-4 text-emerald-300' />Doanh thu</span>
                  <strong className='text-emerald-300'>{formatMoney(showtime.totalEarnings, currency)}</strong>
                </div>
              </div>
            </Section>
          </div>

          {showtime.lifecycle === 'CANCELLED' && (
            <Section icon={CirclePause} iconClassName='border-rose-400/25 bg-rose-500/10 text-rose-300' title='Thông tin hủy suất chiếu' description='Lý do và thời điểm ngừng vận hành'>
              <div className='grid gap-3 sm:grid-cols-[1fr_2fr]'>
                <DetailItem label='Hủy lúc' value={showtime.cancelledAt ? dateFormat(showtime.cancelledAt) : null} />
                <DetailItem label='Lý do hủy' value={showtime.cancellationReason || 'Không có lý do cụ thể'} />
              </div>
            </Section>
          )}
        </div>

        <div className='sticky bottom-0 flex flex-col-reverse gap-3 border-t border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6'>
          <button type='button' onClick={onClose} className='rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-white/5'>Đóng</button>
          <div className='flex flex-col gap-3 sm:flex-row'>
            <button type='button' onClick={() => onEdit(showtime)} disabled={!canEdit} className='inline-flex items-center justify-center gap-2 rounded-full border border-sky-400/40 px-5 py-2.5 text-sm font-medium text-sky-200 transition hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-40'>
              <PenSquare className='h-4 w-4' /> Sửa suất chiếu
            </button>
            <button type='button' onClick={() => onCancel(showtime)} disabled={!canCancel} className='inline-flex items-center justify-center gap-2 rounded-full border border-amber-400/40 px-5 py-2.5 text-sm font-medium text-amber-200 transition hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40'>
              <CirclePause className='h-4 w-4' /> Hủy suất chiếu
            </button>
            <button type='button' onClick={() => onDelete(showtime)} disabled={!canDelete} className='inline-flex items-center justify-center gap-2 rounded-full border border-rose-400/40 px-5 py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40'>
              <Trash2 className='h-4 w-4' /> Xóa
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ShowtimeDetailsModal
