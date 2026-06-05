import React, { useEffect } from 'react'
import {
  Armchair,
  CalendarClock,
  EyeIcon,
  EyeOffIcon,
  Film,
  History,
  MessageSquareText,
  ReceiptText,
  RotateCcwIcon,
  ShieldCheckIcon,
  StarIcon,
  UserRound,
  XCircle,
} from 'lucide-react'

const formatDateTime = (value) => {
  if (!value) return 'Chưa có dữ liệu'

  return new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const DetailItem = ({ label, value, valueClassName = 'text-gray-100' }) => (
  <div className='rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3'>
    <p className='text-xs uppercase tracking-[0.14em] text-gray-500'>{label}</p>
    <p className={`mt-1.5 break-words text-sm font-medium ${valueClassName}`}>{value || 'Chưa có dữ liệu'}</p>
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

const ReviewDetailsModal = ({
  review,
  imageBaseUrl,
  processing,
  onClose,
  onHide,
  onRestore,
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

  if (!review) return null

  const movieTitle = review.movie?.titleVi || review.movie?.title || review.booking?.movieTitle || 'Phim không xác định'
  const roomName = review.booking?.roomName || review.show?.room?.name || 'Chưa có dữ liệu'
  const showDateTime = review.booking?.showDateTime || review.show?.showDateTime
  const hasComment = Boolean(review.comment?.trim())
  const isVisible = review.status === 'VISIBLE'

  return (
    <div
      className='fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-3 py-5 backdrop-blur-sm sm:px-6'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role='dialog'
      aria-modal='true'
      aria-labelledby='review-detail-title'
    >
      <div className='max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-violet-400/20 bg-slate-950 shadow-[0_30px_120px_rgba(0,0,0,0.7)]'>
        <div className='sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur-xl sm:px-6'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <div className='flex flex-wrap items-center gap-2'>
                <h2 id='review-detail-title' className='text-xl font-bold text-white'>Chi tiết đánh giá và bình luận</h2>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                  isVisible
                    ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                    : 'border-rose-400/30 bg-rose-500/15 text-rose-300'
                }`}>
                  {isVisible ? <EyeIcon className='h-3.5 w-3.5' /> : <EyeOffIcon className='h-3.5 w-3.5' />}
                  {isVisible ? 'Đang hiển thị' : 'Đã ẩn'}
                </span>
              </div>
              <p className='mt-2 text-sm text-gray-400'>Tạo lúc {formatDateTime(review.createdAt)}</p>
            </div>
            <button type='button' onClick={onClose} className='rounded-xl border border-white/15 p-2 text-gray-300 transition hover:bg-white/10 hover:text-white' aria-label='Đóng chi tiết đánh giá'>
              <XCircle className='h-5 w-5' />
            </button>
          </div>
        </div>

        <div className='space-y-5 p-4 sm:p-6'>
          <div className='overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-r from-violet-500/15 via-white/[0.03] to-transparent'>
            <div className='flex flex-col gap-5 p-5 sm:flex-row sm:items-center'>
              {review.movie?.poster_path ? (
                <img src={imageBaseUrl + review.movie.poster_path} alt={movieTitle} className='h-32 w-24 shrink-0 rounded-2xl object-cover shadow-xl' />
              ) : (
                <div className='flex h-32 w-24 shrink-0 items-center justify-center rounded-2xl bg-black/30 text-xs text-gray-500'>No poster</div>
              )}
              <div className='min-w-0 flex-1'>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-violet-300'>Thông tin phim</p>
                <h3 className='mt-2 text-2xl font-bold text-white'>{movieTitle}</h3>
                <div className='mt-4 flex flex-wrap gap-2'>
                  {review.isVerifiedViewer && (
                    <span className='inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300'>
                      <ShieldCheckIcon className='h-3.5 w-3.5' /> Đã xem phim
                    </span>
                  )}
                  {review.hasSpoiler && (
                    <span className='rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-xs text-amber-200'>Có spoiler</span>
                  )}
                  <span className='rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-xs text-sky-200'>
                    {hasComment ? 'Có bình luận' : 'Chỉ chấm điểm'}
                  </span>
                </div>
              </div>
              {review.rating && (
                <div className='rounded-2xl border border-amber-400/25 bg-black/20 px-5 py-4 sm:text-right'>
                  <p className='text-xs uppercase tracking-[0.16em] text-gray-500'>Điểm đánh giá</p>
                  <p className='mt-2 text-3xl font-bold text-amber-300'>{review.rating}/10</p>
                  <div className='mt-2 flex gap-0.5'>
                    {Array.from({ length: 10 }, (_, index) => (
                      <StarIcon key={index} className={`h-3 w-3 ${index < review.rating ? 'fill-amber-300 text-amber-300' : 'text-gray-700'}`} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Section icon={MessageSquareText} iconClassName='border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-300' title='Nội dung bình luận' description='Nội dung đầy đủ do người dùng gửi'>
            {hasComment ? (
              <div className={`whitespace-pre-wrap rounded-2xl border p-4 text-sm leading-7 ${
                review.hasSpoiler
                  ? 'border-amber-400/25 bg-amber-500/8 text-amber-50'
                  : 'border-white/10 bg-black/20 text-gray-200'
              }`}>
                {review.comment}
              </div>
            ) : (
              <p className='rounded-xl border border-dashed border-white/10 p-4 text-sm text-gray-500'>Người dùng chỉ chấm điểm và không để lại bình luận.</p>
            )}
          </Section>

          <div className='grid gap-5 lg:grid-cols-2'>
            <Section icon={UserRound} iconClassName='border-sky-400/25 bg-sky-500/10 text-sky-300' title='Người đánh giá' description='Thông tin người gửi đánh giá'>
              <div className='mb-4 flex items-center gap-3 rounded-xl border border-white/8 bg-black/15 p-3'>
                {review.userImage ? (
                  <img src={review.userImage} alt={review.userName} className='h-12 w-12 rounded-full object-cover' />
                ) : (
                  <div className='flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10 font-semibold text-sky-300'>{review.userName?.charAt(0) || 'Q'}</div>
                )}
                <div className='min-w-0'>
                  <p className='font-medium text-white'>{review.userName || 'Người dùng QuickShow'}</p>
                  <p className='mt-1 break-all text-xs text-gray-500'>ID: {review.user || 'Chưa có dữ liệu'}</p>
                </div>
              </div>
              <div className='grid gap-3 sm:grid-cols-2'>
                <DetailItem label='Xác minh người xem' value={review.isVerifiedViewer ? 'Đã xác minh' : 'Chưa xác minh'} valueClassName={review.isVerifiedViewer ? 'text-emerald-300' : 'text-gray-300'} />
                <DetailItem label='Loại đánh giá' value={hasComment ? 'Điểm và bình luận' : 'Chỉ chấm điểm'} />
              </div>
            </Section>

            <Section icon={ReceiptText} iconClassName='border-cyan-400/25 bg-cyan-500/10 text-cyan-300' title='Booking xác minh' description='Thông tin vé gắn với đánh giá'>
              {review.booking ? (
                <div className='grid gap-3 sm:grid-cols-2'>
                  <DetailItem label='Mã booking' value={review.booking.bookingCode} valueClassName='text-cyan-300' />
                  <DetailItem label='Phòng chiếu' value={roomName} />
                  <DetailItem label='Lịch chiếu' value={showDateTime ? formatDateTime(showDateTime) : null} />
                  <DetailItem label='Ghế' value={review.booking.bookedSeats?.join(', ')} />
                  <DetailItem label='Trạng thái booking' value={review.booking.bookingStatus} />
                  <DetailItem label='Thanh toán' value={review.booking.paymentStatus} />
                </div>
              ) : (
                <p className='rounded-xl border border-dashed border-white/10 p-4 text-sm text-gray-500'>Đánh giá này không gắn với booking.</p>
              )}
            </Section>
          </div>

          <Section icon={History} iconClassName='border-indigo-400/25 bg-indigo-500/10 text-indigo-300' title='Lịch sử và kiểm duyệt' description='Các mốc cập nhật và trạng thái quản trị'>
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              <DetailItem label='Ngày tạo' value={formatDateTime(review.createdAt)} />
              <DetailItem label='Cập nhật lần cuối' value={formatDateTime(review.updatedAt)} />
              <DetailItem label='Ẩn lúc' value={review.hiddenAt ? formatDateTime(review.hiddenAt) : 'Chưa từng ẩn'} />
              <DetailItem label='Người thực hiện ẩn' value={review.hiddenBy || 'Chưa có dữ liệu'} />
            </div>
            {review.hiddenReason && (
              <div className='mt-3 rounded-xl border border-rose-400/20 bg-rose-500/8 p-3 text-sm leading-6 text-rose-100'>
                <span className='font-semibold'>Lý do ẩn:</span> {review.hiddenReason}
              </div>
            )}
          </Section>
        </div>

        <div className='sticky bottom-0 flex flex-col-reverse gap-3 border-t border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6'>
          <button type='button' onClick={onClose} className='rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-white/5'>Đóng</button>
          {isVisible ? (
            <button type='button' onClick={() => onHide(review)} disabled={processing} className='inline-flex items-center justify-center gap-2 rounded-full border border-rose-400/40 px-5 py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60'>
              <EyeOffIcon className='h-4 w-4' /> {processing ? 'Đang xử lý...' : 'Ẩn đánh giá'}
            </button>
          ) : (
            <button type='button' onClick={() => onRestore(review)} disabled={processing} className='inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/40 px-5 py-2.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60'>
              <RotateCcwIcon className='h-4 w-4' /> {processing ? 'Đang xử lý...' : 'Khôi phục đánh giá'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReviewDetailsModal
