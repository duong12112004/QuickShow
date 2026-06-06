import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FilterXIcon, MessageSquareIcon, QrCodeIcon, SearchIcon, StarIcon, XIcon } from 'lucide-react';
import Loading from '../components/Loading';
import BlurCircle from '../components/BlurCircle';
import AdminPagination from '../components/admin/AdminPagination';
import timeFormat from '../lib/timeFormat';
import { dateFormat } from '../lib/dateFormat';
import { useAppContext } from '../context/AppContext';
import { getBookingStatusUi, getPaymentStatusUi } from '../lib/bookingStatus';

const MAX_REVIEW_COMMENT_LENGTH = 1500;
const PAGE_SIZE = 4;

const bookingStatusOptions = [
  { value: '', label: 'Tất cả trạng thái vé' },
  { value: 'PENDING_PAYMENT', label: 'Chờ thanh toán' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' },
  { value: 'CHECKED_IN', label: 'Đã check-in' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'PAYMENT_EXPIRED', label: 'Hết hạn thanh toán' },
  { value: 'REFUND_PENDING', label: 'Đang hoàn tiền' },
  { value: 'REFUNDED', label: 'Đã hoàn tiền' },
  { value: 'NO_SHOW', label: 'Không đến xem' }
];

const paymentStatusOptions = [
  { value: '', label: 'Tất cả thanh toán' },
  { value: 'UNPAID', label: 'Chưa thanh toán' },
  { value: 'PAID', label: 'Đã thanh toán' },
  { value: 'EXPIRED', label: 'Đã hết hạn' },
  { value: 'REFUND_PENDING', label: 'Đang hoàn tiền' },
  { value: 'REFUNDED', label: 'Đã hoàn tiền' },
  { value: 'REFUND_FAILED', label: 'Hoàn tiền thất bại' }
];

const darkInputClassName = 'w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-primary/60';
const darkSelectClassName = 'w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-primary/60';
const darkOptionClassName = 'bg-slate-950 text-white';

const initialReviewForm = {
  rating: 0,
  comment: '',
  hasSpoiler: false
};

const MyBookings = () => {
  const { axios, getToken, user, image_base_url, fetchWallet, fetchShows } = useAppContext();
  const currency = import.meta.env.VITE_CURRENCY;

  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState(initialReviewForm);
  const [qrTarget, setQrTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [qrByBookingId, setQrByBookingId] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    q: '',
    bookingStatus: '',
    paymentStatus: ''
  });

  const getMyBookings = async () => {
    try {
      const { data } = await axios.get('/api/user/bookings', {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });

      if (data.success) {
        setBookings(data.bookings || []);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Không thể tải danh sách booking của bạn.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!cancelTarget) return;
    const bookingId = cancelTarget._id;

    try {
      setProcessingId(bookingId);
      const { data } = await axios.post(`/api/user/bookings/${bookingId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });

      if (data.success) {
        toast.success(data.message);
        setCancelTarget(null);
        await Promise.all([getMyBookings(), fetchWallet()]);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Không thể hủy booking lúc này.');
    } finally {
      setProcessingId('');
    }
  };

  const openReviewModal = (booking) => {
    setReviewTarget(booking);
    setReviewForm(initialReviewForm);
  };

  const closeReviewModal = () => {
    if (processingId === reviewTarget?._id) return;

    setReviewTarget(null);
    setReviewForm(initialReviewForm);
  };

  const openQrModal = async (booking) => {
    setQrTarget(booking);

    if (qrByBookingId[booking._id]) {
      return;
    }

    try {
      setProcessingId(booking._id);
      const { data } = await axios.get(`/api/user/bookings/${booking._id}/qr`, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });

      if (data.success) {
        setQrByBookingId((current) => ({
          ...current,
          [booking._id]: data
        }));
      } else {
        setQrTarget(null);
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      setQrTarget(null);
      toast.error('Không thể tải QR check-in lúc này.');
    } finally {
      setProcessingId('');
    }
  };

  const closeQrModal = () => {
    if (processingId === qrTarget?._id) return;
    setQrTarget(null);
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();

    if (!reviewTarget) return;

    const rating = Number(reviewForm.rating || 0);
    const comment = reviewForm.comment.trim();

    if (!rating) {
      toast.error('Vui lòng chọn điểm đánh giá từ 1 đến 10.');
      return;
    }

    if (comment.length > MAX_REVIEW_COMMENT_LENGTH) {
      toast.error(`Bình luận không được vượt quá ${MAX_REVIEW_COMMENT_LENGTH} ký tự.`);
      return;
    }

    try {
      setProcessingId(reviewTarget._id);
      const { data } = await axios.post('/api/reviews/booking', {
        bookingId: reviewTarget._id,
        rating,
        comment,
        hasSpoiler: reviewForm.hasSpoiler
      }, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });

      if (data.success) {
        toast.success(data.message);
        setReviewTarget(null);
        setReviewForm(initialReviewForm);
        await Promise.all([getMyBookings(), fetchShows()]);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Không thể gửi điểm đánh giá lúc này.');
    } finally {
      setProcessingId('');
    }
  };

  useEffect(() => {
    if (user) {
      getMyBookings();
    }
  }, [user]);

  const filteredBookings = useMemo(() => {
    const normalizedQuery = filters.q.trim().toLowerCase();

    return bookings.filter((booking) => {
      if (filters.bookingStatus && booking.bookingStatus !== filters.bookingStatus) {
        return false;
      }

      if (filters.paymentStatus && booking.paymentStatus !== filters.paymentStatus) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        booking.bookingCode,
        booking.movieTitle || booking.show?.movie?.title,
        booking.roomName || booking.show?.room?.name,
        booking.bookedSeats?.join(' ')
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [bookings, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const paginatedBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredBookings.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredBookings, currentPage]);
  const startRow = filteredBookings.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(currentPage * PAGE_SIZE, filteredBookings.length);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters({ q: '', bookingStatus: '', paymentStatus: '' });
    setCurrentPage(1);
  };

  useEffect(() => {
    const nextTotalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
    if (currentPage > nextTotalPages) {
      setCurrentPage(nextTotalPages);
    }
  }, [filteredBookings.length, currentPage]);

  if (isLoading) {
    return <Loading />;
  }

  const reviewMovieTitle = reviewTarget?.movieTitle || reviewTarget?.show?.movie?.title || 'Phim không xác định';
  const reviewPosterPath = reviewTarget?.show?.movie?.poster_path || reviewTarget?.show?.poster_path;
  const reviewShowDateTime = reviewTarget?.showDateTime || reviewTarget?.show?.showDateTime;
  const isSubmittingReview = processingId === reviewTarget?._id;

  return (
    <div className='relative min-h-[80vh] px-6 pt-30 md:px-10 md:pt-40 lg:px-16 xl:px-24'>
      <BlurCircle top='100px' left='100px' />
      <BlurCircle bottom='0px' left='600px' />

      <div className='mx-auto max-w-7xl'>
        <div className='mb-8 flex flex-col gap-2'>
          <h1 className='text-2xl font-semibold'>Booking của tôi</h1>
          <p className='max-w-2xl text-sm text-gray-400'>
            Theo dõi trạng thái vé, thanh toán, hoàn tiền và check-in của từng booking tại đây.
          </p>
        </div>

        {!bookings.length && (
          <div className='rounded-2xl border border-primary/20 bg-primary/8 p-6 text-sm text-gray-300'>
            Bạn chưa có booking nào. Hãy chọn phim, suất chiếu và ghế ngồi để bắt đầu.
          </div>
        )}

        {bookings.length > 0 && (
          <div className='mb-6 rounded-2xl border border-primary/20 bg-primary/8 p-5'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <p className='text-lg font-semibold text-white'>Bộ lọc booking</p>
                <p className='mt-1 text-sm text-gray-400'>
                  Tìm theo mã booking, phim, phòng hoặc ghế. Mỗi trang hiển thị {PAGE_SIZE} booking.
                </p>
              </div>
              <button
                type='button'
                onClick={resetFilters}
                className='inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5'
              >
                <FilterXIcon className='h-4 w-4' />
                Đặt lại
              </button>
            </div>

            <div className='mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]'>
              <label className='relative block'>
                <SearchIcon className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500' />
                <input
                  value={filters.q}
                  onChange={(event) => handleFilterChange('q', event.target.value)}
                  placeholder='Tìm mã booking, phim, phòng, ghế'
                  className={`${darkInputClassName} pl-11`}
                />
              </label>

              <select
                value={filters.bookingStatus}
                onChange={(event) => handleFilterChange('bookingStatus', event.target.value)}
                className={darkSelectClassName}
              >
                {bookingStatusOptions.map((option) => (
                  <option key={option.value || 'all-booking'} value={option.value} className={darkOptionClassName}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.paymentStatus}
                onChange={(event) => handleFilterChange('paymentStatus', event.target.value)}
                className={darkSelectClassName}
              >
                {paymentStatusOptions.map((option) => (
                  <option key={option.value || 'all-payment'} value={option.value} className={darkOptionClassName}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className='mt-4 text-xs text-gray-400'>
              {filteredBookings.length > 0
                ? `Đang hiển thị ${startRow}-${endRow} trên tổng ${filteredBookings.length} booking phù hợp`
                : 'Không có booking phù hợp với bộ lọc hiện tại'}
            </div>
          </div>
        )}

        <div className='space-y-5 pb-10'>
          {paginatedBookings.map((item) => {
            const movieTitle = item.movieTitle || item.show?.movie?.title || 'Phim không xác định';
            const roomName = item.roomName || item.show?.room?.name || 'Chưa có dữ liệu';
            const showDateTime = item.showDateTime || item.show?.showDateTime;
            const bookingStatus = getBookingStatusUi(item.bookingStatus);
            const paymentStatus = getPaymentStatusUi(item.paymentStatus);
            const canPay = item.bookingStatus === 'PENDING_PAYMENT' && item.paymentStatus === 'UNPAID' && item.paymentLink;
            const paymentProviderLabel = item.paymentProvider === 'ZALOPAY_TEST' ? 'ZaloPay' : 'Stripe';
            const canCancel = item.bookingStatus === 'CONFIRMED' && item.paymentStatus === 'PAID';
            const canShowQr = item.bookingStatus === 'CONFIRMED' && item.paymentStatus === 'PAID' && item.isPaid;
            const posterPath = item.show?.movie?.poster_path || item.show?.poster_path;
            const effectiveRefundAmount = item.refundAmount > 0
              ? item.refundAmount
              : item.paymentStatus === 'REFUNDED'
                ? item.amount || 0
                : 0;

            return (
              <div
                key={item._id}
                className='rounded-3xl border border-primary/20 bg-primary/8 p-5 shadow-[0_10px_40px_rgba(244,69,101,0.08)] lg:p-6'
              >
                <div className='grid gap-5 lg:grid-cols-[140px_minmax(0,1fr)_260px] lg:items-start'>
                  <div className='mx-auto w-full max-w-[140px] lg:mx-0'>
                    {posterPath ? (
                      <img
                        src={image_base_url + posterPath}
                        alt={movieTitle}
                        className='aspect-[3/4] w-full rounded-2xl object-cover'
                      />
                    ) : (
                      <div className='flex aspect-[3/4] w-full items-center justify-center rounded-2xl bg-slate-800 text-xs text-slate-400'>
                        Không có ảnh
                      </div>
                    )}
                  </div>

                  <div className='space-y-4'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p className='text-2xl font-semibold leading-tight'>{movieTitle}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${bookingStatus.className}`}>
                        {bookingStatus.label}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${paymentStatus.className}`}>
                        {paymentStatus.label}
                      </span>
                    </div>

                    <div className='grid gap-3 md:grid-cols-2'>
                      <div>
                        <p className='text-xs uppercase tracking-[0.22em] text-primary/70'>Mã booking</p>
                        <p className='mt-2 text-[1.2rem] font-bold tracking-wide text-primary'>{item.bookingCode}</p>
                      </div>

                      <div>
                        <p className='text-xs uppercase tracking-[0.22em] text-emerald-200/80'>Tổng tiền</p>
                        <p className='mt-2 text-[1.2rem] font-bold text-emerald-300'>
                          {(item.amount || 0).toLocaleString()} {currency}
                        </p>
                      </div>
                    </div>

                    <div className='grid gap-x-8 gap-y-3 text-sm text-gray-300 md:grid-cols-2 xl:grid-cols-3'>
                      <p><span className='text-gray-400'>Phòng chiếu:</span> {roomName}</p>
                      <p><span className='text-gray-400'>Lịch chiếu:</span> {showDateTime ? dateFormat(showDateTime) : 'Chưa có dữ liệu'}</p>
                      <p><span className='text-gray-400'>Ghế đã chọn:</span> {item.bookedSeats.join(', ')}</p>
                      <p><span className='text-gray-400'>Số lượng vé:</span> {item.bookedSeats.length}</p>
                      {item.concessionItems?.length > 0 && (
                        <>
                          <p>
                            <span className='text-gray-400'>Combo bắp nước:</span>{' '}
                            {item.concessionItems.map((concession) => `${concession.name} x${concession.quantity}`).join(', ')}
                          </p>
                          <p>
                            <span className='text-gray-400'>Tiền combo:</span>{' '}
                            {(item.concessionAmount || item.concessionItems.reduce((sum, concession) => sum + Number(concession.totalPrice || 0), 0)).toLocaleString()} {currency}
                          </p>
                        </>
                      )}
                      {item.show?.movie?.runtime && (
                        <p><span className='text-gray-400'>Thời lượng:</span> {timeFormat(item.show.movie.runtime)}</p>
                      )}
                      {item.refundedAt && (
                        <p><span className='text-gray-400'>Hoàn tiền lúc:</span> {dateFormat(item.refundedAt)}</p>
                      )}
                      {effectiveRefundAmount > 0 && (
                        <p><span className='text-gray-400'>Hoàn vào ví:</span> {effectiveRefundAmount.toLocaleString()} {currency}</p>
                      )}
                      {item.refundFeeAmount > 0 && (
                        <p><span className='text-gray-400'>Phí hủy:</span> {item.refundFeeAmount.toLocaleString()} {currency}</p>
                      )}
                      {item.walletAmountUsed > 0 && (
                        <p><span className='text-gray-400'>Đã dùng ví:</span> {item.walletAmountUsed.toLocaleString()} {currency}</p>
                      )}
                      {item.stripeAmount > 0 && (
                        <p><span className='text-gray-400'>Thanh toán qua:</span> {paymentProviderLabel}</p>
                      )}
                      {item.checkedInAt && (
                        <p><span className='text-gray-400'>Check-in lúc:</span> {dateFormat(item.checkedInAt)}</p>
                      )}
                    </div>

                    {item.cancelReason && (
                      <p className='rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200'>
                        Lý do hủy: {item.cancelReason}
                      </p>
                    )}

                    {item.refundReason && item.paymentStatus !== 'PAID' && (
                      <p className='rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-2 text-sm text-fuchsia-200'>
                        Thông tin hoàn tiền: {item.refundReason}
                      </p>
                    )}

                  </div>

                  <div className='flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 lg:min-h-full'>
                    <p className='text-sm font-medium text-white'>Thao tác booking</p>

                    {canPay && (
                      <a
                        href={item.paymentLink}
                        className='inline-flex justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-primary-dull'
                      >
                        Thanh toán qua {paymentProviderLabel}
                      </a>
                    )}

                    {canCancel && (
                      <button
                        onClick={() => setCancelTarget(item)}
                        disabled={processingId === item._id}
                        className='rounded-full border border-rose-400/40 px-5 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60'
                      >
                        {processingId === item._id ? 'Đang xử lý...' : 'Hủy booking'}
                      </button>
                    )}

                    {canShowQr && (
                      <button
                        type='button'
                        onClick={() => openQrModal(item)}
                        disabled={processingId === item._id}
                        className='inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/40 px-5 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60'
                      >
                        <QrCodeIcon className='h-4 w-4' />
                        {processingId === item._id ? 'Đang tải QR...' : 'Xem QR check-in'}
                      </button>
                    )}

                    {item.quickShowRating && (
                      <div className='rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary'>
                        <div className='flex items-center gap-2 font-medium'>
                          <StarIcon className='h-4 w-4 fill-primary' />
                          Bạn đã đánh giá {item.quickShowRating.rating}/10
                        </div>
                        {item.quickShowRating.comment && (
                          <div className='mt-2 flex items-center gap-2 text-xs text-gray-300'>
                            <MessageSquareIcon className='h-3.5 w-3.5' />
                            Đã gửi kèm bình luận
                          </div>
                        )}
                      </div>
                    )}

                    {item.canRateQuickShow && (
                      <button
                        type='button'
                        onClick={() => openReviewModal(item)}
                        className='inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dull'
                      >
                        <StarIcon className='h-4 w-4 fill-white' />
                        Đánh giá phim
                      </button>
                    )}

                    {!canPay && !canCancel && !canShowQr && !item.canRateQuickShow && !item.quickShowRating && (
                      <div className='rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300'>
                        Booking này hiện không có thao tác thêm.
                      </div>
                    )}

                    <p className='mt-auto text-xs leading-6 text-gray-400'>
                      Bạn có thể tự hủy vé đã thanh toán trước giờ chiếu ít nhất 24 giờ.
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {bookings.length > 0 && filteredBookings.length === 0 && (
          <div className='mb-10 rounded-2xl border border-primary/20 bg-primary/8 p-6 text-sm text-gray-300'>
            Không có booking nào phù hợp với bộ lọc hiện tại.
          </div>
        )}

        {bookings.length > 0 && (
          <div className='pb-10'>
            <AdminPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              disabled={filteredBookings.length === 0}
            />
          </div>
        )}

        {cancelTarget && (
          <div
            className='fixed inset-0 z-[130] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm'
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && processingId !== cancelTarget._id) {
                setCancelTarget(null);
              }
            }}
          >
            <div
              role='dialog'
              aria-modal='true'
              aria-labelledby='cancel-booking-title'
              className='w-full max-w-lg rounded-3xl border border-rose-400/20 bg-[#11131c] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.6)] sm:p-6'
            >
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <p className='text-xs font-semibold uppercase tracking-[0.2em] text-rose-300'>Xác nhận thao tác</p>
                  <h2 id='cancel-booking-title' className='mt-2 text-xl font-semibold text-white'>Hủy booking {cancelTarget.bookingCode}</h2>
                  <p className='mt-2 text-sm leading-6 text-gray-400'>
                    Bạn có chắc chắn muốn hủy booking này không?
                  </p>
                </div>
                <button
                  type='button'
                  onClick={() => setCancelTarget(null)}
                  disabled={processingId === cancelTarget._id}
                  className='rounded-xl border border-white/10 p-2 text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50'
                  aria-label='Đóng xác nhận hủy booking'
                >
                  <XIcon className='h-5 w-5' />
                </button>
              </div>

              <div className='mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100'>
                Nếu đủ điều kiện, hệ thống sẽ cộng <strong>80%</strong> giá trị booking vào ví QuickShow và giữ <strong>20%</strong> phí hủy.
              </div>

              <div className='mt-5 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300 sm:grid-cols-2'>
                <p><span className='text-gray-500'>Phim:</span> {cancelTarget.movieTitle || cancelTarget.show?.movie?.titleVi || cancelTarget.show?.movie?.title || 'Chưa có dữ liệu'}</p>
                <p><span className='text-gray-500'>Tổng tiền:</span> {(cancelTarget.amount || 0).toLocaleString('vi-VN')} {currency}</p>
                <p><span className='text-gray-500'>Phòng:</span> {cancelTarget.roomName || cancelTarget.show?.room?.name || 'Chưa có dữ liệu'}</p>
                <p><span className='text-gray-500'>Ghế:</span> {cancelTarget.bookedSeats?.join(', ') || 'Chưa có dữ liệu'}</p>
              </div>

              <div className='mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
                <button
                  type='button'
                  onClick={() => setCancelTarget(null)}
                  disabled={processingId === cancelTarget._id}
                  className='rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  Giữ booking
                </button>
                <button
                  type='button'
                  onClick={handleCancelBooking}
                  disabled={processingId === cancelTarget._id}
                  className='rounded-full border border-rose-400/40 bg-rose-500/10 px-5 py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  {processingId === cancelTarget._id ? 'Đang hủy booking...' : 'Xác nhận hủy'}
                </button>
              </div>
            </div>
          </div>
        )}

        {reviewTarget && (
          <div
            className='fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm'
            onMouseDown={closeReviewModal}
          >
            <form
              onSubmit={handleSubmitReview}
              onMouseDown={(event) => event.stopPropagation()}
              className='max-h-[calc(100vh-48px)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#11131c] shadow-[0_30px_100px_rgba(0,0,0,0.55)]'
            >
              <div className='flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6'>
                <div className='flex min-w-0 gap-4'>
                  {reviewPosterPath ? (
                    <img
                      src={image_base_url + reviewPosterPath}
                      alt={reviewMovieTitle}
                      className='h-24 w-16 shrink-0 rounded-xl object-cover'
                    />
                  ) : (
                    <div className='flex h-24 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-[10px] text-slate-400'>
                      Không có ảnh
                    </div>
                  )}

                  <div className='min-w-0'>
                    <p className='text-xs font-medium uppercase tracking-[0.22em] text-primary/80'>Đánh giá phim</p>
                    <h2 className='mt-2 line-clamp-2 text-xl font-semibold text-white'>{reviewMovieTitle}</h2>
                    <p className='mt-2 text-sm text-gray-400'>
                      {reviewShowDateTime ? dateFormat(reviewShowDateTime) : 'Suất chiếu đã kết thúc'}
                    </p>
                  </div>
                </div>

                <button
                  type='button'
                  onClick={closeReviewModal}
                  disabled={isSubmittingReview}
                  className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60'
                  aria-label='Đóng đánh giá'
                >
                  <XIcon className='h-5 w-5' />
                </button>
              </div>

              <div className='space-y-6 p-5 sm:p-6'>
                <div>
                  <div className='mb-3 flex items-center justify-between gap-3'>
                    <p className='text-sm font-medium text-white'>Điểm đánh giá</p>
                    <p className='text-sm font-semibold text-yellow-300'>
                      {reviewForm.rating ? `${reviewForm.rating}/10` : 'Chưa chọn'}
                    </p>
                  </div>

                  <div className='grid grid-cols-5 gap-2 sm:grid-cols-10'>
                    {Array.from({ length: 10 }, (_, index) => {
                      const rating = index + 1;
                      const isSelected = reviewForm.rating >= rating;

                      return (
                        <button
                          key={rating}
                          type='button'
                          onClick={() => setReviewForm((current) => ({ ...current, rating }))}
                          className={`flex h-11 items-center justify-center rounded-xl border text-yellow-300 transition ${
                            isSelected
                              ? 'border-yellow-300/50 bg-yellow-300/15'
                              : 'border-white/10 bg-white/5 hover:border-yellow-300/40 hover:bg-yellow-300/10'
                          }`}
                          aria-label={`Chọn ${rating}/10`}
                        >
                          <StarIcon className={`h-5 w-5 text-yellow-300 ${isSelected ? 'fill-yellow-300' : 'fill-transparent'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className='mb-3 flex items-center justify-between gap-3'>
                    <label htmlFor='booking-review-comment' className='text-sm font-medium text-white'>
                      Bình luận
                    </label>
                    <span className='text-xs text-gray-500'>
                      {reviewForm.comment.length} / {MAX_REVIEW_COMMENT_LENGTH}
                    </span>
                  </div>

                  <textarea
                    id='booking-review-comment'
                    value={reviewForm.comment}
                    onChange={(event) => setReviewForm((current) => ({
                      ...current,
                      comment: event.target.value,
                      hasSpoiler: event.target.value.trim() ? current.hasSpoiler : false
                    }))}
                    maxLength={MAX_REVIEW_COMMENT_LENGTH}
                    rows={5}
                    placeholder='Chia sẻ cảm nhận của bạn về bộ phim...'
                    className='min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-[#080a12] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-gray-500 focus:border-primary/50'
                  />

                  <label className='mt-3 inline-flex items-center gap-2 text-sm text-gray-300'>
                    <input
                      type='checkbox'
                      checked={reviewForm.hasSpoiler}
                      onChange={(event) => setReviewForm((current) => ({ ...current, hasSpoiler: event.target.checked }))}
                      disabled={!reviewForm.comment.trim()}
                      className='h-4 w-4 accent-yellow-300 disabled:cursor-not-allowed disabled:opacity-50'
                    />
                    Bình luận có tiết lộ nội dung phim
                  </label>
                </div>
              </div>

              <div className='flex flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:justify-end sm:p-6'>
                <button
                  type='button'
                  onClick={closeReviewModal}
                  disabled={isSubmittingReview}
                  className='rounded-full border border-white/10 px-5 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60'
                >
                  Hủy
                </button>
                <button
                  type='submit'
                  disabled={!reviewForm.rating || isSubmittingReview}
                  className='inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dull disabled:cursor-not-allowed disabled:opacity-60'
                >
                  <StarIcon className='h-4 w-4 fill-white' />
                  {isSubmittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}
                </button>
              </div>
            </form>
          </div>
        )}

        {qrTarget && (
          <div
            className='fixed inset-0 z-[130] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm'
            onMouseDown={closeQrModal}
          >
            <div
              onMouseDown={(event) => event.stopPropagation()}
              className='w-full max-w-sm rounded-3xl border border-white/10 bg-[#11131c] p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55)]'
            >
              <div className='mb-5 flex items-start justify-between gap-4 text-left'>
                <div>
                  <p className='text-xs font-medium uppercase tracking-[0.22em] text-primary/80'>QR check-in</p>
                  <h2 className='mt-2 line-clamp-2 text-xl font-semibold text-white'>
                    {qrTarget.movieTitle || qrTarget.show?.movie?.title || 'Booking'}
                  </h2>
                  <p className='mt-1 text-sm text-gray-400'>{qrTarget.bookingCode}</p>
                </div>
                <button
                  type='button'
                  onClick={closeQrModal}
                  disabled={processingId === qrTarget._id}
                  className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60'
                  aria-label='Đóng QR check-in'
                >
                  <XIcon className='h-5 w-5' />
                </button>
              </div>

              {qrByBookingId[qrTarget._id]?.qrDataUrl ? (
                <div className='rounded-2xl bg-white p-4'>
                  <img
                    src={qrByBookingId[qrTarget._id].qrDataUrl}
                    alt={`QR check-in ${qrTarget.bookingCode}`}
                    className='mx-auto h-64 w-64'
                  />
                </div>
              ) : (
                <div className='flex h-72 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-gray-400'>
                  Đang tải QR...
                </div>
              )}

              <p className='mt-4 text-sm leading-6 text-gray-300'>
                Đưa QR này cho nhân viên rạp quét khi đến check-in.
              </p>
              {qrTarget.concessionItems?.length > 0 && (
                <div className='mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-left text-sm text-amber-100'>
                  <p className='font-medium text-amber-50'>Combo đã mua</p>
                  <p className='mt-1'>{qrTarget.concessionItems.map((item) => `${item.name} x${item.quantity}`).join(', ')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBookings;
