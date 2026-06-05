import React, { useEffect } from 'react';
import {
  Armchair,
  Ban,
  CalendarClock,
  Check,
  ClipboardCopy,
  CreditCard,
  History,
  MapPin,
  Popcorn,
  ReceiptText,
  RefreshCcw,
  UserRound,
  WalletCards,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { dateFormat } from '../../lib/dateFormat';
import { getBookingStatusUi, getPaymentStatusUi } from '../../lib/bookingStatus';

const actorLabels = {
  ADMIN: 'Quản trị viên',
  USER: 'Khách hàng',
  SYSTEM: 'Hệ thống',
  STRIPE: 'Stripe',
  ZALOPAY: 'ZaloPay',
};

const seatTypeLabels = {
  STANDARD: 'Ghế thường',
  VIP: 'Ghế VIP',
  SWEETBOX: 'Sweetbox',
  COUPLE: 'Ghế đôi',
};

const formatMoney = (value, currency) => `${Number(value || 0).toLocaleString('vi-VN')} ${currency}`;

const DetailItem = ({ label, value, highlight = false }) => (
  <div className='rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3'>
    <p className='text-xs uppercase tracking-[0.14em] text-gray-500'>{label}</p>
    <p className={`mt-1.5 break-words text-sm font-medium ${highlight ? 'text-primary' : 'text-gray-100'}`}>
      {value || 'Chưa có dữ liệu'}
    </p>
  </div>
);

const Section = ({ icon, iconClassName = 'border-sky-400/25 bg-sky-500/10 text-sky-300', title, description, children, className = '' }) => (
  <section className={`rounded-2xl border border-white/10 bg-white/[0.025] p-4 ${className}`}>
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
);

const BookingDetailsModal = ({
  booking,
  currency: defaultCurrency,
  imageBaseUrl,
  onClose,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!booking) return null;

  const currency = booking.currency || defaultCurrency || 'VND';
  const movieTitle = booking.movieTitle || booking.show?.movie?.title || 'Phim không xác định';
  const posterPath = booking.show?.movie?.poster_path || booking.show?.poster_path;
  const roomName = booking.roomName || booking.show?.room?.name || 'Chưa có dữ liệu';
  const showDateTime = booking.showDateTime || booking.show?.showDateTime;
  const bookingStatus = getBookingStatusUi(booking.bookingStatus);
  const paymentStatus = getPaymentStatusUi(booking.paymentStatus);
  const canCancel = ['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.bookingStatus);
  const providerLabel = booking.paymentProvider === 'ZALOPAY_TEST' ? 'ZaloPay' : 'Stripe';
  const onlineAmount = booking.stripeAmount || 0;
  const effectiveRefundAmount = booking.refundAmount > 0
    ? booking.refundAmount
    : booking.paymentStatus === 'REFUNDED'
      ? booking.amount || 0
      : 0;
  const seatDetails = booking.seatDetails?.length
    ? booking.seatDetails
    : (booking.bookedSeats || []).map((seatNumber) => ({ seatNumber }));
  const statusHistory = [...(booking.statusHistory || [])].reverse();

  const copyBookingCode = async () => {
    await navigator.clipboard.writeText(booking.bookingCode);
    toast.success('Đã sao chép mã booking.');
  };

  return (
    <div
      className='fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-3 py-5 backdrop-blur-sm sm:px-6'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role='dialog'
      aria-modal='true'
      aria-labelledby='booking-detail-title'
    >
      <div className='max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-primary/25 bg-slate-950 shadow-[0_30px_120px_rgba(0,0,0,0.7)]'>
        <div className='sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur-xl sm:px-6'>
          <div className='flex items-start justify-between gap-4'>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <h2 id='booking-detail-title' className='text-xl font-bold text-white'>Chi tiết booking</h2>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${bookingStatus.className}`}>
                  {bookingStatus.label}
                </span>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${paymentStatus.className}`}>
                  {paymentStatus.label}
                </span>
              </div>
              <p className='mt-2 text-sm text-gray-400'>
                Mã <span className='font-semibold tracking-wide text-primary'>{booking.bookingCode}</span>
                {' · '}Tạo lúc {dateFormat(booking.createdAt)}
              </p>
            </div>
            <button
              type='button'
              onClick={onClose}
              className='shrink-0 rounded-xl border border-white/15 p-2 text-gray-300 transition hover:bg-white/10 hover:text-white'
              aria-label='Đóng chi tiết booking'
            >
              <XCircle className='h-5 w-5' />
            </button>
          </div>
        </div>

        <div className='space-y-5 p-4 sm:p-6'>
          <div className='overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/15 via-white/[0.03] to-transparent'>
            <div className='flex flex-col gap-5 p-5 sm:flex-row sm:items-center'>
              {posterPath ? (
                <img src={imageBaseUrl + posterPath} alt={movieTitle} className='h-32 w-24 shrink-0 rounded-2xl object-cover shadow-xl' />
              ) : (
                <div className='flex h-32 w-24 shrink-0 items-center justify-center rounded-2xl bg-black/30 text-xs text-gray-500'>No poster</div>
              )}
              <div className='min-w-0 flex-1'>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-primary'>Thông tin suất chiếu</p>
                <h3 className='mt-2 text-2xl font-bold text-white'>{movieTitle}</h3>
                <div className='mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-300'>
                  <span className='inline-flex items-center gap-2'><MapPin className='h-4 w-4 text-sky-300' />{roomName}</span>
                  <span className='inline-flex items-center gap-2'><CalendarClock className='h-4 w-4 text-violet-300' />{showDateTime ? dateFormat(showDateTime) : 'Chưa có lịch chiếu'}</span>
                  <span className='inline-flex items-center gap-2'><Armchair className='h-4 w-4 text-cyan-300' />{seatDetails.length} ghế</span>
                </div>
              </div>
              <div className='rounded-2xl border border-primary/25 bg-black/20 px-5 py-4 sm:text-right'>
                <p className='text-xs uppercase tracking-[0.16em] text-gray-500'>Tổng thanh toán</p>
                <p className='mt-2 text-2xl font-bold text-primary'>{formatMoney(booking.amount, currency)}</p>
              </div>
            </div>
          </div>

          <div className='grid gap-5 lg:grid-cols-2'>
            <Section icon={UserRound} iconClassName='border-sky-400/25 bg-sky-500/10 text-sky-300' title='Khách hàng' description='Thông tin người thực hiện đặt vé'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <DetailItem label='Họ và tên' value={booking.user?.name || 'Người dùng đã xóa'} />
                <DetailItem label='Email' value={booking.user?.email || 'Không có email'} />
              </div>
            </Section>

            <Section icon={ReceiptText} iconClassName='border-violet-400/25 bg-violet-500/10 text-violet-300' title='Trạng thái xử lý' description='Các mốc vận hành quan trọng'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <DetailItem label='Cập nhật trạng thái' value={booking.lastStatusChangedAt ? dateFormat(booking.lastStatusChangedAt) : ''} />
                <DetailItem label='Hết hạn thanh toán' value={booking.expiresAt ? dateFormat(booking.expiresAt) : ''} />
                <DetailItem label='Check-in lúc' value={booking.checkedInAt ? dateFormat(booking.checkedInAt) : ''} />
                <DetailItem label='Hủy lúc' value={booking.cancelledAt ? dateFormat(booking.cancelledAt) : ''} />
              </div>
            </Section>
          </div>

          <div className='grid gap-5 lg:grid-cols-[1.25fr_0.75fr]'>
            <Section icon={Armchair} iconClassName='border-cyan-400/25 bg-cyan-500/10 text-cyan-300' title='Chi tiết vé và ghế' description={`${seatDetails.length} ghế trong booking`}>
              <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                {seatDetails.map((seat, index) => (
                  <div key={`${seat.seatNumber}-${index}`} className='rounded-xl border border-sky-400/20 bg-sky-500/8 p-3'>
                    <div className='flex items-center justify-between gap-3'>
                      <span className='text-lg font-bold text-sky-200'>{seat.seatNumber}</span>
                      {seat.unitPrice != null && <span className='text-xs font-medium text-white'>{formatMoney(seat.unitPrice, currency)}</span>}
                    </div>
                    <p className='mt-1 text-xs text-gray-400'>{seatTypeLabels[seat.seatType] || seat.seatType || 'Chưa phân loại'}</p>
                  </div>
                ))}
              </div>
              {!seatDetails.length && <p className='text-sm text-gray-500'>Booking chưa có dữ liệu ghế.</p>}
            </Section>

            <Section icon={Popcorn} iconClassName='border-amber-400/25 bg-amber-500/10 text-amber-300' title='Bắp nước / combo' description='Danh sách cần giao cho khách'>
              {booking.concessionItems?.length > 0 ? (
                <div className='space-y-3'>
                  {booking.concessionItems.map((item, index) => (
                    <div key={`${item.name}-${index}`} className='rounded-xl border border-amber-400/20 bg-amber-500/8 p-3'>
                      <div className='flex items-start justify-between gap-3'>
                        <div>
                          <p className='font-medium text-amber-100'>{item.name}</p>
                          <p className='mt-1 text-xs text-gray-400'>{item.category || 'Combo'} · {formatMoney(item.unitPrice, currency)} x {item.quantity}</p>
                        </div>
                        <p className='shrink-0 text-sm font-semibold text-white'>{formatMoney(item.totalPrice, currency)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className='rounded-xl border border-dashed border-white/10 p-4 text-sm text-gray-500'>Booking không mua thêm bắp nước hoặc combo.</p>
              )}
            </Section>
          </div>

          <div className='grid gap-5 lg:grid-cols-2'>
            <Section icon={CreditCard} iconClassName='border-emerald-400/25 bg-emerald-500/10 text-emerald-300' title='Đối soát thanh toán' description={`Cổng thanh toán: ${providerLabel}`}>
              <div className='space-y-2 text-sm'>
                <div className='flex justify-between gap-4 text-gray-300'><span>Tiền vé</span><span>{formatMoney(booking.ticketAmount, currency)}</span></div>
                <div className='flex justify-between gap-4 text-gray-300'><span>Bắp nước / combo</span><span>{formatMoney(booking.concessionAmount, currency)}</span></div>
                <div className='my-3 border-t border-white/10' />
                <div className='flex justify-between gap-4 font-semibold text-white'><span>Tổng booking</span><span>{formatMoney(booking.amount, currency)}</span></div>
                <div className='flex justify-between gap-4 text-gray-400'><span className='inline-flex items-center gap-2'><WalletCards className='h-4 w-4' />Thanh toán bằng ví</span><span>{formatMoney(booking.walletAmountUsed, currency)}</span></div>
                <div className='flex justify-between gap-4 text-gray-400'><span>Thanh toán qua {providerLabel}</span><span>{formatMoney(onlineAmount, currency)}</span></div>
              </div>
            </Section>

            <Section icon={RefreshCcw} iconClassName='border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-300' title='Hủy và hoàn tiền' description='Thông tin phát sinh sau thanh toán'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <DetailItem label='Số tiền đã hoàn' value={formatMoney(effectiveRefundAmount, currency)} highlight={effectiveRefundAmount > 0} />
                <DetailItem label='Phí hủy' value={formatMoney(booking.refundFeeAmount, currency)} />
                <DetailItem label='Tỷ lệ hoàn' value={booking.refundRate ? `${Math.round(booking.refundRate * 100)}%` : '0%'} />
                <DetailItem label='Phương thức hoàn' value={booking.refundMethod || ''} />
              </div>
              {(booking.cancelReason || booking.refundReason) && (
                <div className='mt-3 rounded-xl border border-rose-400/20 bg-rose-500/8 p-3 text-sm leading-6 text-rose-100'>
                  {booking.cancelReason && <p><span className='font-semibold'>Lý do hủy:</span> {booking.cancelReason}</p>}
                  {booking.refundReason && <p><span className='font-semibold'>Thông tin hoàn tiền:</span> {booking.refundReason}</p>}
                </div>
              )}
            </Section>
          </div>

          <Section icon={History} iconClassName='border-indigo-400/25 bg-indigo-500/10 text-indigo-300' title='Lịch sử trạng thái' description='Dòng thời gian thay đổi gần nhất'>
            {statusHistory.length > 0 ? (
              <div className='space-y-0'>
                {statusHistory.map((entry, index) => {
                  const historyStatus = getBookingStatusUi(entry.status);
                  const historyPayment = getPaymentStatusUi(entry.paymentStatus);
                  return (
                    <div key={`${entry.createdAt}-${index}`} className='relative flex gap-4 pb-5 last:pb-0'>
                      {index < statusHistory.length - 1 && <div className='absolute left-[13px] top-7 h-[calc(100%-20px)] w-px bg-white/10' />}
                      <div className='z-[1] mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300'>
                        <Check className='h-3.5 w-3.5' />
                      </div>
                      <div className='min-w-0 flex-1 rounded-xl border border-white/8 bg-black/15 p-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${historyStatus.className}`}>{historyStatus.label}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${historyPayment.className}`}>{historyPayment.label}</span>
                        </div>
                        <p className='mt-2 text-sm text-gray-200'>{entry.note || 'Cập nhật trạng thái booking.'}</p>
                        <p className='mt-1 text-xs text-gray-500'>{dateFormat(entry.createdAt)} · {actorLabels[entry.actor] || entry.actor || 'Hệ thống'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className='rounded-xl border border-dashed border-white/10 p-4 text-sm text-gray-500'>Chưa có lịch sử trạng thái cho booking này.</p>
            )}
          </Section>
        </div>

        <div className='sticky bottom-0 flex flex-col-reverse gap-3 border-t border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6'>
          <button type='button' onClick={copyBookingCode} className='inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-white/5'>
            <ClipboardCopy className='h-4 w-4' /> Sao chép mã booking
          </button>
          <div className='flex flex-col-reverse gap-3 sm:flex-row'>
            <button type='button' onClick={onClose} className='rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-white/5'>Đóng</button>
            {canCancel && (
              <button type='button' onClick={() => onCancel(booking._id)} className='inline-flex items-center justify-center gap-2 rounded-full border border-rose-400/40 px-5 py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-500/10'>
                <Ban className='h-4 w-4' /> Hủy booking
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailsModal;
