import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  ChevronDown,
  ClipboardCopy,
  Download,
  Eye,
  FilterX,
  ImageUp,
  QrCode,
  Search,
  TicketCheck,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import AdminPagination from '../../components/admin/AdminPagination';
import BookingDetailsModal from '../../components/admin/BookingDetailsModal';
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
  const { axios, getToken, user, image_base_url } = useAppContext();

  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [checkInCode, setCheckInCode] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isQrImageUploadOpen, setIsQrImageUploadOpen] = useState(false);
  const [isScanningQrImage, setIsScanningQrImage] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('');
  const [lastCheckInResult, setLastCheckInResult] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [filters, setFilters] = useState({
    q: '',
    bookingStatus: '',
    paymentStatus: ''
  });
  const qrProcessingRef = useRef(false);
  const handleQrCheckInRef = useRef(null);
  const qrFileInputRef = useRef(null);

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
  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking._id === selectedBookingId) || null,
    [bookings, selectedBookingId]
  );

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
        const concessionText = data.booking.concessionItems?.length
          ? ` | Combo: ${data.booking.concessionItems.map((item) => `${item.name} x${item.quantity}`).join(', ')}`
          : '';
        toast.success(`${data.message} Khách: ${data.booking.userName} | Ghế: ${data.booking.bookedSeats.join(', ')}${concessionText}`);
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

  const handleQrCheckIn = async (qrToken) => {
    if (!qrToken || qrProcessingRef.current) return;

    try {
      qrProcessingRef.current = true;
      setScannerStatus('Đã đọc QR, đang xác thực booking...');
      const { data } = await axios.post('/api/admin/bookings/check-in/qr', {
        qrToken
      }, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });

      if (data.success) {
        setLastCheckInResult(data.booking);
        setScannerStatus('');
        const concessionText = data.booking.concessionItems?.length
          ? ` | Combo: ${data.booking.concessionItems.map((item) => `${item.name} x${item.quantity}`).join(', ')}`
          : '';
        toast.success(`${data.message} Khách: ${data.booking.userName} | Ghế: ${data.booking.bookedSeats.join(', ')}${concessionText}`);
        await getAllBookings(filters, { silent: true });
        setIsScannerOpen(false);
      } else {
        setScannerStatus('QR đã đọc nhưng không check-in được. Hãy thử lại hoặc nhập mã booking.');
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      setScannerStatus('Không thể check-in bằng QR. Hãy thử lại hoặc nhập mã booking.');
      toast.error('Không thể check-in bằng QR.');
    } finally {
      qrProcessingRef.current = false;
    }
  };

  handleQrCheckInRef.current = handleQrCheckIn;

  const handleQrImageSelect = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    let fileScanner = null;

    try {
      setIsScanningQrImage(true);
      setScannerStatus('Đang đọc QR từ ảnh đã chọn...');

      fileScanner = new Html5Qrcode('booking-qr-file-reader');
      const decodedText = await fileScanner.scanFile(file, true);
      try {
        await fileScanner.clear();
      } catch (clearError) {
        console.error(clearError);
      }

      if (!decodedText) {
        setScannerStatus('Không tìm thấy QR trong ảnh. Hãy chọn ảnh rõ hơn hoặc nhập mã booking.');
        toast.error('Không tìm thấy QR trong ảnh.');
        return;
      }

      await handleQrCheckIn(decodedText);
    } catch (error) {
      console.error(error);
      setScannerStatus('Không đọc được QR từ ảnh. Hãy chọn ảnh rõ nét hơn hoặc nhập mã booking.');
      toast.error('Không đọc được QR từ ảnh.');
    } finally {
      if (fileScanner) {
        try {
          await fileScanner.clear();
        } catch (clearError) {
          console.error(clearError);
        }
      }
      setIsScanningQrImage(false);
      event.target.value = '';
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

  useEffect(() => {
    if (!isScannerOpen) return undefined;

    const scanner = new Html5Qrcode('booking-qr-reader');
    let isMounted = true;
    let noQrTimer = null;
    setScannerStatus('Đang mở camera...');

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decodedText) => {
        if (isMounted) {
          handleQrCheckInRef.current?.(decodedText);
        }
      },
      () => {}
    )
      .then(() => {
        if (!isMounted) return;
        setScannerStatus('Đang quét QR. Giữ QR đủ sáng, thẳng góc và cách camera khoảng 15-30 cm.');
        noQrTimer = window.setTimeout(() => {
          if (!isMounted || qrProcessingRef.current) return;
          setScannerStatus('Chưa đọc được QR. Nếu camera mờ, hãy nhập mã booking ở ô bên dưới.');
          toast('Chưa đọc được QR. Bạn có thể nhập mã booking để check-in.', { icon: 'ⓘ' });
        }, 30000);
      })
      .catch((error) => {
        console.error(error);
        setScannerStatus('Không thể mở camera. Hãy kiểm tra quyền camera hoặc nhập mã booking.');
        toast.error('Không thể mở camera để quét QR.');
        setIsScannerOpen(false);
      });

    return () => {
      isMounted = false;
      if (noQrTimer) {
        window.clearTimeout(noQrTimer);
      }
      setScannerStatus('');
      scanner.stop()
        .then(() => scanner.clear())
        .catch(() => {
          try {
            scanner.clear();
          } catch (error) {
            console.error(error);
          }
        });
    };
  }, [isScannerOpen]);

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

      <div className='grid items-start gap-6 xl:grid-cols-[2fr_1fr]'>
        <div className='self-start rounded-2xl border border-primary/20 bg-primary/8 p-4'>
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
              {isLoading
                ? 'Đang tải dữ liệu booking...'
                : bookings.length > 0
                ? `Đang hiển thị ${startRow}-${endRow} trên tổng ${bookings.length} booking`
                : 'Không có booking phù hợp'}
            </p>
            {isFetching && <p>Đang cập nhật dữ liệu...</p>}
          </div>
        </div>

        <form onSubmit={handleCheckIn} className='self-start rounded-2xl border border-primary/20 bg-primary/8 p-4'>
          <p className='mb-2 text-lg font-semibold'>Check-in vé</p>
          <p className='mb-4 text-sm text-gray-400'>
            Quét QR từ vé/email của khách hoặc nhập mã booking để xác nhận vào rạp.
          </p>
          <button
            type='button'
            onClick={() => setIsScannerOpen((current) => !current)}
            className='mb-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-400/40 px-5 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/10'
          >
            <QrCode className='h-4 w-4' />
            {isScannerOpen ? 'Tắt camera quét QR' : 'Mở camera quét QR'}
          </button>

          <input
            ref={qrFileInputRef}
            type='file'
            accept='image/*'
            onChange={handleQrImageSelect}
            className='hidden'
          />
          <button
            type='button'
            onClick={() => setIsQrImageUploadOpen((current) => !current)}
            className='mb-3 inline-flex h-9 w-full items-center justify-center rounded-full border border-white/15 text-gray-300 transition hover:bg-white/5 hover:text-white'
            aria-label={isQrImageUploadOpen ? 'Ẩn chọn ảnh QR' : 'Hiện chọn ảnh QR'}
            aria-expanded={isQrImageUploadOpen}
          >
            <ChevronDown className={`h-4 w-4 transition ${isQrImageUploadOpen ? 'rotate-180' : ''}`} />
          </button>
          {isQrImageUploadOpen && (
            <button
              type='button'
              onClick={() => qrFileInputRef.current?.click()}
              disabled={isScanningQrImage}
              className='mb-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky-400/40 px-5 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60'
            >
              <ImageUp className='h-4 w-4' />
              {isScanningQrImage ? 'Đang đọc ảnh QR...' : 'Chọn ảnh QR để Quét'}
            </button>
          )}
          <div id='booking-qr-file-reader' className='hidden' />

          {isScannerOpen && (
            <div className='mb-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-2'>
              <div id='booking-qr-reader' className='min-h-64 text-sm text-gray-300' />
            </div>
          )}

          {scannerStatus && (
            <div className='mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100'>
              {scannerStatus}
            </div>
          )}

          {lastCheckInResult && (
            <div className='mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100'>
              <p className='font-medium'>{lastCheckInResult.bookingCode} - {lastCheckInResult.userName}</p>
              <p className='mt-1 text-emerald-100/80'>
                {lastCheckInResult.movieTitle} | Ghế: {lastCheckInResult.bookedSeats.join(', ')}
              </p>
              {lastCheckInResult.concessionItems?.length > 0 && (
                <p className='mt-1 text-emerald-100/80'>
                  Combo: {lastCheckInResult.concessionItems.map((item) => `${item.name} x${item.quantity}`).join(', ')}
                </p>
              )}
            </div>
          )}

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
            {isLoading ? (
              <tr>
                <td colSpan={8} className='p-6 text-center text-gray-400'>Đang tải dữ liệu booking...</td>
              </tr>
            ) : paginatedBookings.map((item) => {
              const movieTitle = item.movieTitle || item.show?.movie?.title || 'Phim không xác định';
              const posterPath = item.show?.movie?.poster_path || item.show?.poster_path;
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
                    <div className='flex items-center gap-2'>
                      <div className='font-semibold text-white'>{item.bookingCode}</div>
                      <button
                        type='button'
                        onClick={async () => {
                          await navigator.clipboard.writeText(item.bookingCode);
                          toast.success('Đã sao chép mã booking.');
                        }}
                        className='rounded-lg border border-white/10 p-1.5 text-gray-400 transition hover:border-sky-400/40 hover:bg-sky-500/10 hover:text-sky-300'
                        aria-label={`Sao chép mã booking ${item.bookingCode}`}
                        title='Sao chép mã booking'
                      >
                        <ClipboardCopy className='h-3.5 w-3.5' />
                      </button>
                    </div>
                    <div className='mt-1 text-xs text-gray-400'>Tạo lúc: {dateFormat(item.createdAt)}</div>
                  </td>
                  <td className='p-3'>
                    <div className='font-medium text-white'>{item.user?.name || 'Người dùng đã xóa'}</div>
                    <div className='mt-1 text-xs text-gray-400'>{item.user?.email || 'Không có email'}</div>
                  </td>
                  <td className='p-3'>
                    <div className='flex gap-3'>
                      {posterPath ? (
                        <img
                          src={image_base_url + posterPath}
                          alt={movieTitle}
                          className='h-20 w-14 shrink-0 rounded-xl object-cover'
                        />
                      ) : (
                        <div className='flex h-20 w-14 shrink-0 items-center justify-center rounded-xl bg-black/20 text-[10px] text-gray-500'>
                          No poster
                        </div>
                      )}

                      <div className='min-w-0'>
                        <div className='line-clamp-2 font-medium text-white'>{movieTitle}</div>
                        <div className='mt-1 text-xs text-gray-400'>Phòng: {roomName}</div>
                        <div className='mt-1 text-xs text-gray-400'>{showDateTime ? dateFormat(showDateTime) : 'Chưa có dữ liệu'}</div>
                      </div>
                    </div>
                  </td>
                  <td className='p-3 text-gray-200'>
                    <p>{item.bookedSeats.join(', ')}</p>
                    {item.concessionItems?.length > 0 && (
                      <div className='mt-2 rounded-xl border border-amber-400/20 bg-amber-500/10 p-2 text-xs text-amber-100'>
                        <p className='font-medium'>Combo cần giao</p>
                        <p className='mt-1'>{item.concessionItems.map((concession) => `${concession.name} x${concession.quantity}`).join(', ')}</p>
                      </div>
                    )}
                  </td>
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
                        Hoàn vào ví: {effectiveRefundAmount.toLocaleString()} {currency}
                      </p>
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
                      <p className='mt-1 text-xs text-gray-400'>
                        {item.paymentProvider === 'ZALOPAY_TEST' ? 'ZaloPay' : 'Stripe'}: {item.stripeAmount.toLocaleString()} {currency}
                      </p>
                    )}
                  </td>
                  <td className='p-3'>
                    <div className='flex flex-col gap-2'>
                      <button
                        type='button'
                        onClick={() => setSelectedBookingId(item._id)}
                        className='inline-flex items-center justify-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/5 px-4 py-2 text-xs font-medium text-sky-200 transition hover:bg-sky-500/15 hover:text-sky-100'
                      >
                        <Eye className='h-3.5 w-3.5' />
                        Xem chi tiết
                      </button>
                      {canCancel && (
                        <button
                          type='button'
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

        {!isLoading && !bookings.length && (
          <div className='p-6 text-sm text-gray-400'>
            Không có booking nào phù hợp với bộ lọc hiện tại.
          </div>
        )}
      </div>

      <AdminPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        disabled={bookings.length === 0}
      />

      {selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          currency={currency}
          imageBaseUrl={image_base_url}
          onClose={() => setSelectedBookingId('')}
          onCancel={handleCancelBooking}
        />
      )}
    </div>
  );
};

export default ListBookings;
