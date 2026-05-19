import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  FilterX,
  Search,
  TicketCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Loading from '../../components/Loading';
import Title from '../../components/admin/Title';
import { dateFormat } from '../../lib/dateFormat';
import { useAppContext } from '../../context/AppContext';
import { getBookingStatusUi, getPaymentStatusUi } from '../../lib/bookingStatus';

const PAGE_SIZE = 5;

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

const darkInputClassName = 'w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-primary';
const darkSelectClassName = 'w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-primary';
const darkOptionClassName = 'bg-slate-950 text-white';

const ListBookings = () => {
  const currency = import.meta.env.VITE_CURRENCY;
  const { axios, getToken, user } = useAppContext();

  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [checkInCode, setCheckInCode] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    q: '',
    bookingStatus: '',
    paymentStatus: ''
  });

  const getAllBookings = async (nextFilters = filters, options = {}) => {
    const { silent = false } = options;

    try {
      if (silent) {
        setIsFetching(true);
      } else {
        setIsLoading(true);
      }

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
      setIsFetching(false);
    }
  };

  const stats = useMemo(() => ({
    total: bookings.length,
    confirmed: bookings.filter((booking) => booking.bookingStatus === 'CONFIRMED').length,
    refunded: bookings.filter((booking) => booking.paymentStatus === 'REFUNDED').length,
    totalRevenue: bookings
      .filter((booking) => ['PAID', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED'].includes(booking.paymentStatus))
      .reduce((sum, booking) => sum + (booking.amount || 0), 0)
  }), [bookings]);

  const totalPages = Math.max(1, Math.ceil(bookings.length / PAGE_SIZE));
  const paginatedBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return bookings.slice(startIndex, startIndex + PAGE_SIZE);
  }, [bookings, currentPage]);
  const startRow = bookings.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(currentPage * PAGE_SIZE, bookings.length);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters({ q: '', bookingStatus: '', paymentStatus: '' });
    setCurrentPage(1);
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
        await getAllBookings(filters, { silent: true });
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
        await getAllBookings(filters, { silent: true });
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
    if (!user) return;

    const timeoutId = setTimeout(() => {
      getAllBookings(filters, { silent: !isLoading });
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [user, filters.q, filters.bookingStatus, filters.paymentStatus]);

  useEffect(() => {
    const nextTotalPages = Math.max(1, Math.ceil(bookings.length / PAGE_SIZE));
    if (currentPage > nextTotalPages) {
      setCurrentPage(nextTotalPages);
    }
  }, [bookings.length, currentPage]);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className='space-y-8'>
      <Title text1='Quản lý' text2='Booking' />

      <div className='grid gap-4 md:grid-cols-4'>
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

      <div className='grid gap-6 xl:grid-cols-[2fr_1fr]'>
        <div className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
            <div>
              <p className='text-lg font-semibold'>Bộ lọc booking</p>
              <p className='text-sm text-gray-400'>
                Gõ từ khóa hoặc đổi trạng thái để lọc dữ liệu ngay. Mỗi trang hiển thị 5 bản ghi.
              </p>
            </div>

            <div className='flex flex-wrap gap-2'>
              <button
                type='button'
                onClick={handleResetFilters}
                className='inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5'
              >
                <FilterX className='h-4 w-4' />
                Đặt lại
              </button>
              <button
                type='button'
                onClick={handleExport}
                disabled={isExporting}
                className='inline-flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60'
              >
                <Download className='h-4 w-4' />
                {isExporting ? 'Đang xuất...' : 'Xuất CSV'}
              </button>
            </div>
          </div>

          <div className='mt-5 grid gap-3 md:grid-cols-3'>
            <label className='relative block'>
              <Search className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500' />
              <input
                value={filters.q}
                onChange={(event) => handleFilterChange('q', event.target.value)}
                placeholder='Tìm theo mã booking, phim, tên khách, email'
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

          <div className='mt-4 flex items-center justify-between text-xs text-gray-400'>
            <p>
              {bookings.length > 0
                ? `Đang hiển thị ${startRow}-${endRow} trên tổng ${bookings.length} booking`
                : 'Không có booking phù hợp'}
            </p>
            {isFetching && <p>Đang cập nhật dữ liệu...</p>}
          </div>
        </div>

        <form onSubmit={handleCheckIn} className='rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='mb-2 text-lg font-semibold'>Check-in bằng mã booking</p>
          <p className='mb-4 text-sm text-gray-400'>
            Nhân viên nhập mã booking do khách cung cấp để xác nhận vào rạp.
          </p>
          <input
            value={checkInCode}
            onChange={(event) => setCheckInCode(event.target.value.toUpperCase())}
            placeholder='Ví dụ: QS123456ABCD'
            className={`${darkInputClassName} uppercase`}
          />
          <button
            type='submit'
            className='mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-400'
          >
            <TicketCheck className='h-4 w-4' />
            Xác nhận check-in
          </button>
        </form>
      </div>

      <div className='overflow-x-auto rounded-2xl border border-primary/20 bg-primary/8'>
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
            {paginatedBookings.map((item) => {
              const movieTitle = item.movieTitle || item.show?.movie?.title || 'Phim không xác định';
              const roomName = item.roomName || item.show?.room?.name || 'Chưa có dữ liệu';
              const showDateTime = item.showDateTime || item.show?.showDateTime;
              const bookingStatus = getBookingStatusUi(item.bookingStatus);
              const paymentStatus = getPaymentStatusUi(item.paymentStatus);
              const canCancel = ['PENDING_PAYMENT', 'CONFIRMED'].includes(item.bookingStatus);
              const effectiveRefundAmount = item.refundAmount > 0
                ? item.refundAmount
                : item.paymentStatus === 'REFUNDED'
                  ? item.amount || 0
                  : 0;

              return (
                <tr key={item._id} className='border-b border-primary/15 align-top even:bg-white/2'>
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
                    {effectiveRefundAmount > 0 && (
                      <p className='mt-2 text-xs text-fuchsia-200'>
                        {item.refundMethod === 'WALLET' ? 'Ví' : 'Hoàn'}: {effectiveRefundAmount.toLocaleString()} {currency}
                      </p>
                    )}
                    {item.stripeRefundAmount > 0 && (
                      <p className='mt-1 text-xs text-sky-200'>Stripe: {item.stripeRefundAmount.toLocaleString()} {currency}</p>
                    )}
                    {item.walletRefundAmount > 0 && (
                      <p className='mt-1 text-xs text-emerald-200'>Ví: {item.walletRefundAmount.toLocaleString()} {currency}</p>
                    )}
                    {item.refundFeeAmount > 0 && (
                      <p className='mt-1 text-xs text-amber-200'>Phí hủy: {item.refundFeeAmount.toLocaleString()} {currency}</p>
                    )}
                  </td>
                  <td className='p-3'>
                    <p className='font-medium text-primary'>{(item.amount || 0).toLocaleString()} {currency}</p>
                    {item.walletAmountUsed > 0 && (
                      <p className='mt-1 text-xs text-gray-400'>Ví: {item.walletAmountUsed.toLocaleString()} {currency}</p>
                    )}
                    {item.stripeAmount > 0 && (
                      <p className='mt-1 text-xs text-gray-400'>Stripe: {item.stripeAmount.toLocaleString()} {currency}</p>
                    )}
                  </td>
                  <td className='p-3'>
                    <div className='flex flex-col gap-2'>
                      <button
                        onClick={() => navigator.clipboard.writeText(item.bookingCode)}
                        className='inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-gray-200 transition hover:bg-white/5'
                      >
                        <ClipboardCopy className='h-3.5 w-3.5' />
                        Sao chép mã
                      </button>
                      {canCancel && (
                        <button
                          onClick={() => handleCancelBooking(item._id)}
                          className='inline-flex items-center justify-center gap-2 rounded-full border border-rose-400/40 px-4 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/10'
                        >
                          <Ban className='h-3.5 w-3.5' />
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

      <div className='flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300 md:flex-row md:items-center md:justify-between'>
        <p>Trang {currentPage}/{totalPages}</p>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className='inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50'
          >
            <ChevronLeft className='h-4 w-4' />
            Trước
          </button>
          <button
            type='button'
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || bookings.length === 0}
            className='inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50'
          >
            Sau
            <ChevronRight className='h-4 w-4' />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListBookings;
