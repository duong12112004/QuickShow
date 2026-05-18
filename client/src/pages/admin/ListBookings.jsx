import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Loading from '../../components/Loading';
import Title from '../../components/admin/Title';
import { dateFormat } from '../../lib/dateFormat';
import { useAppContext } from '../../context/AppContext';
import { getBookingStatusUi, getPaymentStatusUi } from '../../lib/bookingStatus';

const bookingStatusOptions = [
  { value: '', label: 'Tất cả trạng thái booking' },
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
  { value: '', label: 'Tất cả trạng thái thanh toán' },
  { value: 'UNPAID', label: 'Chưa thanh toán' },
  { value: 'PAID', label: 'Đã thanh toán' },
  { value: 'EXPIRED', label: 'Đã hết hạn' },
  { value: 'REFUND_PENDING', label: 'Đang hoàn tiền' },
  { value: 'REFUNDED', label: 'Đã hoàn tiền' },
  { value: 'REFUND_FAILED', label: 'Hoàn tiền thất bại' }
];

const ListBookings = () => {
  const currency = import.meta.env.VITE_CURRENCY;
  const { axios, getToken, user } = useAppContext();

  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [checkInCode, setCheckInCode] = useState('');
  const [filters, setFilters] = useState({
    q: '',
    bookingStatus: '',
    paymentStatus: ''
  });

  const getAllBookings = async (nextFilters = filters) => {
    try {
      const { data } = await axios.get('/api/admin/bookings', {
        params: nextFilters,
        headers: { Authorization: `Bearer ${await getToken()}` }
      });

      if (data.success) {
        setBookings(data.bookings || []);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Không thể tải danh sách booking.');
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => ({
    total: bookings.length,
    confirmed: bookings.filter((booking) => booking.bookingStatus === 'CONFIRMED').length,
    refunded: bookings.filter((booking) => booking.paymentStatus === 'REFUNDED').length,
    totalRevenue: bookings
      .filter((booking) => ['PAID', 'REFUND_PENDING', 'REFUNDED'].includes(booking.paymentStatus))
      .reduce((sum, booking) => sum + (booking.amount || 0), 0)
  }), [bookings]);

  const handleFilterChange = (key, value) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
  };

  const handleApplyFilters = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    await getAllBookings(filters);
  };

  const handleResetFilters = async () => {
    const resetFilters = { q: '', bookingStatus: '', paymentStatus: '' };
    setFilters(resetFilters);
    setIsLoading(true);
    await getAllBookings(resetFilters);
  };

  const handleCancelBooking = async (bookingId) => {
    const cancelReason = window.prompt('Nhập lý do hủy booking:');

    if (!cancelReason) return;

    try {
      const { data } = await axios.patch(`/api/admin/bookings/${bookingId}/cancel`, {
        cancelReason
      }, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });

      if (data.success) {
        toast.success(data.message);
        await getAllBookings(filters);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Không thể hủy booking lúc này.');
    }
  };

  const handleCheckIn = async (event) => {
    event.preventDefault();

    if (!checkInCode.trim()) {
      return toast.error('Vui lòng nhập mã booking để check-in.');
    }

    try {
      const { data } = await axios.post('/api/admin/bookings/check-in', {
        bookingCode: checkInCode.trim().toUpperCase()
      }, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });

      if (data.success) {
        toast.success(`${data.message} Khách: ${data.booking.userName} | Ghế: ${data.booking.bookedSeats.join(', ')}`);
        setCheckInCode('');
        await getAllBookings(filters);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Không thể check-in booking.');
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const response = await axios.get('/api/admin/bookings/export', {
        params: filters,
        responseType: 'blob',
        headers: { Authorization: `Bearer ${await getToken()}` }
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bao-cao-booking-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error('Không thể xuất báo cáo booking.');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (user) {
      getAllBookings();
    }
  }, [user]);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <>
      <Title text1="Quản lý" text2="Booking" />

      <div className='mt-6 grid gap-4 md:grid-cols-4'>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Tổng booking</p>
          <p className='mt-2 text-2xl font-semibold'>{stats.total}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Đã xác nhận</p>
          <p className='mt-2 text-2xl font-semibold text-emerald-300'>{stats.confirmed}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Đã hoàn tiền</p>
          <p className='mt-2 text-2xl font-semibold text-fuchsia-300'>{stats.refunded}</p>
        </div>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='text-sm text-gray-400'>Doanh thu gộp</p>
          <p className='mt-2 text-2xl font-semibold text-primary'>{stats.totalRevenue.toLocaleString()} {currency}</p>
        </div>
      </div>

      <div className='mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]'>
        <form onSubmit={handleApplyFilters} className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='mb-4 text-lg font-semibold'>Bộ lọc booking</p>
          <div className='grid gap-3 md:grid-cols-3'>
            <input
              value={filters.q}
              onChange={(event) => handleFilterChange('q', event.target.value)}
              placeholder='Tìm theo mã booking, phim, tên khách, email'
              className='rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none transition focus:border-primary'
            />
            <select
              value={filters.bookingStatus}
              onChange={(event) => handleFilterChange('bookingStatus', event.target.value)}
              className='rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none transition focus:border-primary'
            >
              {bookingStatusOptions.map((option) => (
                <option key={option.value || 'all-booking'} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              value={filters.paymentStatus}
              onChange={(event) => handleFilterChange('paymentStatus', event.target.value)}
              className='rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none transition focus:border-primary'
            >
              {paymentStatusOptions.map((option) => (
                <option key={option.value || 'all-payment'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className='mt-4 flex flex-wrap gap-3'>
            <button type='submit' className='rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-primary-dull'>
              Áp dụng bộ lọc
            </button>
            <button
              type='button'
              onClick={handleResetFilters}
              className='rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5'
            >
              Đặt lại
            </button>
            <button
              type='button'
              onClick={handleExport}
              disabled={isExporting}
              className='rounded-full border border-primary/30 px-5 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {isExporting ? 'Đang xuất...' : 'Xuất CSV'}
            </button>
          </div>
        </form>

        <form onSubmit={handleCheckIn} className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='mb-4 text-lg font-semibold'>Check-in bằng mã booking</p>
          <input
            value={checkInCode}
            onChange={(event) => setCheckInCode(event.target.value.toUpperCase())}
            placeholder='Ví dụ: QS123456ABCD'
            className='w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm uppercase outline-none transition focus:border-primary'
          />
          <button type='submit' className='mt-4 w-full rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-400'>
            Xác nhận check-in
          </button>
          <p className='mt-3 text-xs text-gray-400'>
            Nhân viên nhập mã booking do khách cung cấp để xác nhận vào rạp.
          </p>
        </form>
      </div>

      <div className='mt-6 overflow-x-auto rounded-2xl border border-primary/20 bg-primary/8'>
        <table className='w-full min-w-[1180px] border-collapse text-left text-sm'>
          <thead>
            <tr className='border-b border-primary/20 bg-primary/12 text-white'>
              <th className='p-3 pl-5 font-medium'>Mã booking</th>
              <th className='p-3 font-medium'>Khách hàng</th>
              <th className='p-3 font-medium'>Phim / lịch chiếu</th>
              <th className='p-3 font-medium'>Ghế</th>
              <th className='p-3 font-medium'>Trạng thái</th>
              <th className='p-3 font-medium'>Thanh toán</th>
              <th className='p-3 font-medium'>Tổng tiền</th>
              <th className='p-3 font-medium'>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((item) => {
              const movieTitle = item.movieTitle || item.show?.movie?.title || 'Phim không xác định';
              const roomName = item.roomName || item.show?.room?.name || 'Chưa có dữ liệu';
              const showDateTime = item.showDateTime || item.show?.showDateTime;
              const bookingStatus = getBookingStatusUi(item.bookingStatus);
              const paymentStatus = getPaymentStatusUi(item.paymentStatus);
              const canCancel = ['PENDING_PAYMENT', 'CONFIRMED'].includes(item.bookingStatus);

              return (
                <tr key={item._id} className='border-b border-primary/15 align-top even:bg-white/[0.02]'>
                  <td className='p-3 pl-5'>
                    <div className='font-semibold text-white'>{item.bookingCode}</div>
                    <div className='mt-1 text-xs text-gray-400'>Tạo lúc: {dateFormat(item.createdAt)}</div>
                  </td>
                  <td className='p-3'>
                    <div className='font-medium text-white'>{item.user?.name || 'Người dùng đã xóa'}</div>
                    <div className='mt-1 text-xs text-gray-400'>{item.user?.email || 'Không có email'}</div>
                  </td>
                  <td className='p-3'>
                    <div className='font-medium text-white'>{movieTitle}</div>
                    <div className='mt-1 text-xs text-gray-400'>Phòng: {roomName}</div>
                    <div className='mt-1 text-xs text-gray-400'>{showDateTime ? dateFormat(showDateTime) : 'Chưa có dữ liệu'}</div>
                  </td>
                  <td className='p-3 text-gray-200'>{item.bookedSeats.join(', ')}</td>
                  <td className='p-3'>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${bookingStatus.className}`}>
                      {bookingStatus.label}
                    </span>
                    {item.checkedInAt && <p className='mt-2 text-xs text-gray-400'>Check-in: {dateFormat(item.checkedInAt)}</p>}
                    {item.cancelReason && <p className='mt-2 max-w-52 text-xs text-rose-200'>Lý do: {item.cancelReason}</p>}
                  </td>
                  <td className='p-3'>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${paymentStatus.className}`}>
                      {paymentStatus.label}
                    </span>
                    {item.refundedAt && <p className='mt-2 text-xs text-gray-400'>Hoàn lúc: {dateFormat(item.refundedAt)}</p>}
                  </td>
                  <td className='p-3 font-medium text-primary'>{(item.amount || 0).toLocaleString()} {currency}</td>
                  <td className='p-3'>
                    <div className='flex flex-col gap-2'>
                      <button
                        onClick={() => navigator.clipboard.writeText(item.bookingCode)}
                        className='rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-gray-200 transition hover:bg-white/5'
                      >
                        Sao chép mã
                      </button>
                      {canCancel && (
                        <button
                          onClick={() => handleCancelBooking(item._id)}
                          className='rounded-full border border-rose-400/40 px-4 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/10'
                        >
                          Hủy booking
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!bookings.length && (
          <div className='p-6 text-sm text-gray-400'>
            Không có booking nào phù hợp với bộ lọc hiện tại.
          </div>
        )}
      </div>
    </>
  );
};

export default ListBookings;
