import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageSquareIcon, QrCodeIcon, StarIcon, XIcon } from 'lucide-react';
import Loading from '../components/Loading';
import BlurCircle from '../components/BlurCircle';
import timeFormat from '../lib/timeFormat';
import { dateFormat } from '../lib/dateFormat';
import { useAppContext } from '../context/AppContext';
import { getBookingStatusUi, getPaymentStatusUi } from '../lib/bookingStatus';

const MAX_REVIEW_COMMENT_LENGTH = 1500;

const initialReviewForm = {
  rating: 0,
  comment: '',
  hasSpoiler: false
};

const MyBookings = () => {
  const { axios, getToken, user, image_base_url, wallet, fetchWallet, fetchShows } = useAppContext();
  const currency = import.meta.env.VITE_CURRENCY;

  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState(initialReviewForm);
  const [qrTarget, setQrTarget] = useState(null);
  const [qrByBookingId, setQrByBookingId] = useState({});

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

  const handleCancelBooking = async (bookingId) => {
    const confirmed = window.confirm('Bạn có chắc chắn muốn hủy booking này không? Nếu đủ điều kiện, hệ thống sẽ cộng 80% giá trị booking vào ví QuickShow và giữ 20% phí hủy.');

    if (!confirmed) return;

    try {
      setProcessingId(bookingId);
      const { data } = await axios.post(`/api/user/bookings/${bookingId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });

      if (data.success) {
        toast.success(data.message);
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
      Promise.all([getMyBookings(), fetchWallet()]);
    }
  }, [user]);

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

        <div className='mb-8 rounded-2xl border border-primary/20 bg-primary/8 p-5'>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div>
              <p className='text-sm text-gray-400'>Ví QuickShow</p>
              <p className='mt-2 text-2xl font-semibold text-primary'>{(wallet.balance || 0).toLocaleString()} {currency}</p>
            </div>
            <p className='max-w-xl text-sm text-gray-300'>
              Tiền hoàn từ vé tự hủy sẽ được cộng vào ví và có thể dùng để trừ trực tiếp khi đặt vé tiếp theo.
            </p>
          </div>
        </div>

        {!bookings.length && (
          <div className='rounded-2xl border border-primary/20 bg-primary/8 p-6 text-sm text-gray-300'>
            Bạn chưa có booking nào. Hãy chọn phim, suất chiếu và ghế ngồi để bắt đầu.
          </div>
        )}

        <div className='space-y-5 pb-10'>
          {bookings.map((item) => {
            const movieTitle = item.movieTitle || item.show?.movie?.title || 'Phim không xác định';
            const roomName = item.roomName || item.show?.room?.name || 'Chưa có dữ liệu';
            const showDateTime = item.showDateTime || item.show?.showDateTime;
            const bookingStatus = getBookingStatusUi(item.bookingStatus);
            const paymentStatus = getPaymentStatusUi(item.paymentStatus);
            const canPay = item.bookingStatus === 'PENDING_PAYMENT' && item.paymentStatus === 'UNPAID' && item.paymentLink;
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
                        Thanh toán ngay
                      </a>
                    )}

                    {canCancel && (
                      <button
                        onClick={() => handleCancelBooking(item._id)}
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBookings;
