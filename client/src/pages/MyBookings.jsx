import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Loading from '../components/Loading';
import BlurCircle from '../components/BlurCircle';
import timeFormat from '../lib/timeFormat';
import { dateFormat } from '../lib/dateFormat';
import { useAppContext } from '../context/AppContext';
import { getBookingStatusUi, getPaymentStatusUi } from '../lib/bookingStatus';

const MyBookings = () => {
  const { axios, getToken, user, image_base_url } = useAppContext();
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
    const confirmed = window.confirm('Bạn có chắc chắn muốn hủy booking này không? Nếu đủ điều kiện, hệ thống sẽ gửi yêu cầu hoàn tiền trên Stripe test.');

    if (!confirmed) return;

    try {
      setProcessingId(bookingId);
      const { data } = await axios.post(`/api/user/bookings/${bookingId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });

      if (data.success) {
        toast.success(data.message);
        await getMyBookings();
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
      getMyBookings();
    }
  }, [user]);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className='relative min-h-[80vh] px-6 pt-30 md:px-16 md:pt-40 lg:px-40'>
      <BlurCircle top='100px' left='100px' />
      <BlurCircle bottom='0px' left='600px' />

      <div className='mb-8 flex flex-col gap-2'>
        <h1 className='text-2xl font-semibold'>Booking của tôi</h1>
        <p className='max-w-2xl text-sm text-gray-400'>
          Theo dõi trạng thái vé, thanh toán, hoàn tiền và check-in của từng booking tại đây.
        </p>
      </div>

      {!bookings.length && (
        <div className='max-w-3xl rounded-2xl border border-primary/20 bg-primary/8 p-6 text-sm text-gray-300'>
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

          return (
            <div
              key={item._id}
              className='max-w-4xl rounded-2xl border border-primary/20 bg-primary/8 p-4 shadow-[0_10px_40px_rgba(244,69,101,0.08)]'
            >
              <div className='flex flex-col gap-5 md:flex-row md:items-start md:justify-between'>
                <div className='flex flex-1 flex-col gap-4 md:flex-row'>
                  {posterPath ? (
                    <img
                      src={image_base_url + posterPath}
                      alt={movieTitle}
                      className='aspect-[3/4] w-28 rounded-xl object-cover'
                    />
                  ) : (
                    <div className='flex aspect-[3/4] w-28 items-center justify-center rounded-xl bg-slate-800 text-xs text-slate-400'>
                      Không có ảnh
                    </div>
                  )}

                  <div className='flex-1 space-y-3'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p className='text-xl font-semibold'>{movieTitle}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${bookingStatus.className}`}>
                        {bookingStatus.label}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${paymentStatus.className}`}>
                        {paymentStatus.label}
                      </span>
                    </div>

                    <div className='grid gap-2 text-sm text-gray-300 md:grid-cols-2'>
                      <p><span className='text-gray-400'>Mã booking:</span> {item.bookingCode}</p>
                      <p><span className='text-gray-400'>Phòng chiếu:</span> {roomName}</p>
                      <p><span className='text-gray-400'>Lịch chiếu:</span> {showDateTime ? dateFormat(showDateTime) : 'Chưa có dữ liệu'}</p>
                      <p><span className='text-gray-400'>Ghế đã chọn:</span> {item.bookedSeats.join(', ')}</p>
                      <p><span className='text-gray-400'>Số lượng vé:</span> {item.bookedSeats.length}</p>
                      <p><span className='text-gray-400'>Tổng tiền:</span> {(item.amount || 0).toLocaleString()} {currency}</p>
                      {item.show?.movie?.runtime && (
                        <p><span className='text-gray-400'>Thời lượng:</span> {timeFormat(item.show.movie.runtime)}</p>
                      )}
                      {item.refundedAt && (
                        <p><span className='text-gray-400'>Hoàn tiền lúc:</span> {dateFormat(item.refundedAt)}</p>
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
                </div>

                <div className='flex min-w-56 flex-col gap-3 md:items-end md:text-right'>
                  {canPay && (
                    <a
                      href={item.paymentLink}
                      className='rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-primary-dull'
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

                  <p className='text-xs text-gray-400'>
                    Bạn có thể tự hủy vé đã thanh toán trước giờ chiếu ít nhất 24 giờ.
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyBookings;
