import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Loading from '../components/Loading';
import BlurCircle from '../components/BlurCircle';
import timeFormat from '../lib/timeFormat';
import { dateFormat } from '../lib/dateFormat';
import { useAppContext } from '../context/AppContext';
import { getBookingStatusUi, getPaymentStatusUi } from '../lib/bookingStatus';

const MyBookings = () => {
  const { axios, getToken, user, image_base_url, wallet, fetchWallet } = useAppContext();
  const currency = import.meta.env.VITE_CURRENCY;

  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');

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

  useEffect(() => {
    if (user) {
      Promise.all([getMyBookings(), fetchWallet()]);
    }
  }, [user]);

  if (isLoading) {
    return <Loading />;
  }

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

                    {!canPay && !canCancel && (
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
      </div>
    </div>
  );
};

export default MyBookings;
