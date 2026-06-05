import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { assets } from '../assets/assets'
import Loading from '../components/Loading'
import { ArrowRightIcon, CalendarDaysIcon, ClockIcon, CreditCardIcon, InfoIcon, MapPinIcon, MinusIcon, PlusIcon, PopcornIcon, QrCodeIcon, TicketIcon, WalletIcon, XIcon } from 'lucide-react'
import isoTimeFormat from '../lib/isoTimeFormat'
import timeFormat from '../lib/timeFormat'
import toast from 'react-hot-toast'
import BlurCircle from '../components/BlurCircle'
import { useAppContext } from '../context/AppContext'
import { socket } from '../configs/socket';

const getSeatUnitPrice = (seatType, basePrice) => {
  if (seatType === 'VIP') return basePrice + 20000
  if (seatType === 'COUPLE') return basePrice * 2
  return basePrice
}

const getSeatTypeLabel = (seatType) => {
  if (seatType === 'VIP') return 'VIP'
  if (seatType === 'COUPLE') return 'Ghế đôi'
  return 'Tiêu chuẩn'
}

const formatMoney = (value, currency) => `${Number(value || 0).toLocaleString()} ${currency}`
const MAX_CONCESSION_PER_ITEM = 3
const MAX_CONCESSION_TOTAL = 10
const paymentMethods = [
  { value: 'STRIPE', label: 'Stripe', description: 'Thẻ quốc tế', Icon: CreditCardIcon },
  { value: 'ZALOPAY', label: 'ZaloPay', description: 'Ví ZaloPay sandbox', Icon: QrCodeIcon }
]

// Component hiển thị sơ đồ ghế ngồi và xử lý luồng đặt vé Real-time
const SeatLayout = () => {
  const { id, date } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedSeats, setSelectedSeats] = useState([])
  const [selectedTime, setSelectedTime] = useState(null)
  const [show, setShow] = useState(null)

  const [seatMap, setSeatMap] = useState([])
  const [heldSeats, setHeldSeats] = useState([])
  const [occupiedSeats, setOccupiedSeats] = useState([])
  const [roomData, setRoomData] = useState(null) 
  const [basePrice, setBasePrice] = useState(0)
  const [useWallet, setUseWallet] = useState(true)
  const [paymentProvider, setPaymentProvider] = useState('STRIPE')
  const [concessions, setConcessions] = useState([])
  const [concessionQuantities, setConcessionQuantities] = useState({})
  const [isConcessionModalOpen, setIsConcessionModalOpen] = useState(false)

  // Quản lý trạng thái ghế đang được người dùng khác click xem (Real-time)
  const [liveViewingSeats, setLiveViewingSeats] = useState([])

  const { axios, getToken, user, walletBalance, fetchWallet } = useAppContext()
  const currency = import.meta.env.VITE_CURRENCY
  const preferredShowId = new URLSearchParams(location.search).get('showId')

  // Lấy thông tin chi tiết của phim và lịch chiếu
  const getShow = async () => {
    try {
      const { data } = await axios.get(`/api/show/${id}`)
      if (data.success) setShow(data)
    } catch (error) { console.log(error) }
  }

  // Lấy sơ đồ ghế và trạng thái hiện tại của phòng chiếu
  const getSeatLayout = async () => {
    try {
      const { data } = await axios.get(`/api/show/${selectedTime.showId}/seat-layout`)
      if (data.success) {
        setSeatMap(data.seatMap)
        setOccupiedSeats(data.occupiedSeats || [])
        setHeldSeats(data.heldSeats || []) 
        setBasePrice(data.basePrice)
        setRoomData({ roomName: data.roomName })
      } else {
        toast.error(data.message)
      }
    } catch (error) { console.log(error) }
  }

  const getConcessions = async () => {
    try {
      const { data } = await axios.get('/api/concessions')
      if (data.success) {
        setConcessions(data.concessions || [])
      }
    } catch (error) { console.log(error) }
  }

  // Xử lý đồng bộ dữ liệu ghế ngồi theo thời gian thực (Socket.io)
  useEffect(() => {
    if (!selectedTime) return;

    // Báo cho Server biết client đang truy cập vào phòng của suất chiếu này
    socket.emit('join_show', selectedTime.showId);

    // Cập nhật giao diện khi có người dùng khác đang click chọn/bỏ chọn ghế
    const handleUpdateLiveSeats = ({ seatId, action }) => {
      if (action === 'select') {
        setLiveViewingSeats(prev => [...new Set([...prev, seatId])]);
      } else if (action === 'deselect') {
        setLiveViewingSeats(prev => prev.filter(s => s !== seatId));
      }
    };

    // Khóa ghế tạm thời khi có người dùng khác chuyển sang bước thanh toán
    const handleLockSeats = (seatsToLock) => {
      setHeldSeats(prev => [...new Set([...prev, ...seatsToLock])]);
      setLiveViewingSeats(prev => prev.filter(s => !seatsToLock.includes(s)));
    };

    // Chốt ghế vĩnh viễn khi có giao dịch thanh toán thành công
    const handleSeatsBooked = (bookedSeats) => {
      setOccupiedSeats(prev => [...new Set([...prev, ...bookedSeats])]);
      setHeldSeats(prev => prev.filter(s => !bookedSeats.includes(s)));
      setLiveViewingSeats(prev => prev.filter(s => !bookedSeats.includes(s)));
    };

    // Nhả ghế nếu người dùng khác quá hạn thời gian giữ chỗ thanh toán
    const handleSeatsReleased = (releasedSeats) => {
      setHeldSeats(prev => prev.filter(s => !releasedSeats.includes(s)));
    };

    // Đăng ký các sự kiện lắng nghe
    socket.on('update_live_seats', handleUpdateLiveSeats);
    socket.on('lock_seats_temporarily', handleLockSeats);
    socket.on('seats_booked_successfully', handleSeatsBooked);
    socket.on('seats_released', handleSeatsReleased);

    // Hủy đăng ký sự kiện (Cleanup) khi component bị unmount hoặc người dùng đổi suất chiếu
    return () => {
      socket.off('update_live_seats', handleUpdateLiveSeats);
      socket.off('lock_seats_temporarily', handleLockSeats);
      socket.off('seats_booked_successfully', handleSeatsBooked);
      socket.off('seats_released', handleSeatsReleased);
    };
  }, [selectedTime]);

  const handleSeatClick = (seatId) => {
    if (!selectedTime) return toast.error("Vui lòng chọn khung giờ chiếu trước!")
    if (!selectedSeats.includes(seatId) && selectedSeats.length >= 5) {
      return toast.error("Bạn chỉ có thể đặt tối đa 5 ghế trong một lần giao dịch!")
    }
    
    // Chặn thao tác nếu ghế đã bán, đang giữ chỗ, hoặc người khác đang click chọn (live)
    if (occupiedSeats.includes(seatId) || heldSeats.includes(seatId) || liveViewingSeats.includes(seatId)) {
        return toast.error("Ghế này hiện không khả dụng!")
    }

    const isSelecting = !selectedSeats.includes(seatId);

    setSelectedSeats(prev => isSelecting ? [...prev, seatId] : prev.filter(seat => seat !== seatId));

    // Phát tín hiệu Real-time cho các người dùng khác biết mình đang thao tác ghế này
    socket.emit('seat_selecting', {
        showId: selectedTime.showId,
        seatId: seatId,
        action: isSelecting ? 'select' : 'deselect'
    });
  }

  const bookTickets = async () => {
    try {
      if (!user) return toast.error('Vui lòng đăng nhập để tiếp tục!')
      if (!selectedTime || !selectedSeats.length) return toast.error('Vui lòng chọn khung giờ chiếu và ghế ngồi!')

      // Phát tín hiệu khóa ghế lên hệ thống khi bắt đầu thanh toán
      socket.emit('seat_held_checkout', {
          showId: selectedTime.showId,
          selectedSeats: selectedSeats
      });

      const { data } = await axios.post('/api/booking/create', {
        showId: selectedTime.showId,
        selectedSeats,
        concessions: selectedConcessions.map((item) => ({
          concessionId: item._id,
          quantity: item.quantity
        })),
        useWallet,
        paymentProvider
      }, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      })

      if (data.success) {
        if (data.paidWithWallet) {
          toast.success('Đã thanh toán bằng ví QuickShow.')
          await fetchWallet()
          navigate('/my-bookings')
          return
        }

        window.location.assign(data.url);
      } else {
        toast.error(data.message)
      }
    } catch (error) { toast.error("Có lỗi xảy ra: " + error.message) }
  }

  // Thuật toán tính tổng giá tiền dựa trên phân loại ghế (Backend sẽ tính lại lần nữa để bảo mật)
  const calculateTotalPrice = () => {
    if (!basePrice || selectedSeats.length === 0) return 0;
    let total = 0;
    selectedSeats.forEach(seatNum => {
      let sType = 'STANDARD';
      seatMap.forEach(rowObj => {
        rowObj.seats.forEach(s => {
          if (s.seatNumber === seatNum) sType = s.seatType;
        });
      });
      total += getSeatUnitPrice(sType, basePrice);
    });
    return total;
  };

  const seatCatalog = useMemo(() => {
    const catalog = new Map()
    seatMap.forEach((rowObj) => {
      rowObj.seats?.forEach((seat) => {
        if (seat.seatType !== 'EMPTY') {
          catalog.set(seat.seatNumber, seat)
        }
      })
    })
    return catalog
  }, [seatMap])

  const selectedSeatDetails = useMemo(() => (
    selectedSeats.map((seatNumber) => {
      const seat = seatCatalog.get(seatNumber)
      const seatType = seat?.seatType || 'STANDARD'
      return {
        seatNumber,
        seatType,
        label: getSeatTypeLabel(seatType),
        unitPrice: getSeatUnitPrice(seatType, basePrice)
      }
    })
  ), [selectedSeats, seatCatalog, basePrice])

  const updateConcessionQuantity = (concessionId, delta) => {
    setConcessionQuantities((current) => {
      const currentQuantity = Number(current[concessionId] || 0)
      const currentTotal = Object.values(current).reduce((sum, quantity) => sum + Number(quantity || 0), 0)

      if (delta > 0 && (currentQuantity >= MAX_CONCESSION_PER_ITEM || currentTotal >= MAX_CONCESSION_TOTAL)) {
        return current
      }

      const nextQuantity = Math.max(0, Math.min(MAX_CONCESSION_PER_ITEM, currentQuantity + delta))
      const next = { ...current }

      if (nextQuantity === 0) {
        delete next[concessionId]
      } else {
        next[concessionId] = nextQuantity
      }

      return next
    })
  }

  const selectedConcessions = concessions
    .map((item) => {
      const quantity = Number(concessionQuantities[item._id] || 0)
      return {
        ...item,
        quantity,
        totalPrice: Number(item.price || 0) * quantity
      }
    })
    .filter((item) => item.quantity > 0)

  const concessionTotal = selectedConcessions.reduce((sum, item) => sum + item.totalPrice, 0)
  const concessionItemCount = selectedConcessions.reduce((sum, item) => sum + item.quantity, 0)

  const clearConcessions = () => {
    setConcessionQuantities({})
  }

  const seatStats = useMemo(() => {
    let capacity = 0
    let standard = 0
    let vip = 0
    let couple = 0

    seatMap.forEach((rowObj) => {
      rowObj.seats?.forEach((seat) => {
        if (seat.seatType === 'EMPTY') return
        capacity += 1
        if (seat.seatType === 'VIP') vip += 1
        else if (seat.seatType === 'COUPLE') couple += 1
        else standard += 1
      })
    })

    const sold = occupiedSeats.length
    const held = heldSeats.length
    return {
      capacity,
      standard,
      vip,
      couple,
      sold,
      held,
      available: Math.max(capacity - sold - held, 0)
    }
  }, [seatMap, occupiedSeats.length, heldSeats.length])

  const ticketTotal = calculateTotalPrice()
  const totalPrice = ticketTotal + concessionTotal
  const walletAmountUsed = useWallet ? Math.min(walletBalance, totalPrice) : 0
  const stripeAmount = Math.max(totalPrice - walletAmountUsed, 0)
  const paymentProviderLabel = paymentProvider === 'ZALOPAY' ? 'ZaloPay' : 'Stripe'
  const movie = show?.movie
  const movieTitle = movie?.title || movie?.original_title || 'Phim đang chiếu'
  const selectedShowDate = selectedTime?.time
    ? new Date(selectedTime.time).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      getShow()
      getConcessions()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [id])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!show?.dateTime?.[date]) return

      if (preferredShowId) {
        const preferredShow = show.dateTime[date].find((item) => item.showId === preferredShowId)
        if (preferredShow) {
          setSelectedTime(preferredShow)
          return
        }
      }

      setSelectedTime(null)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [show, date, preferredShowId])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchWallet()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [user])

  useEffect(() => {
    if (!selectedTime) return undefined

    const timeoutId = setTimeout(() => {
      getSeatLayout()
      setSelectedSeats([])
      setLiveViewingSeats([])
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [selectedTime])

  return show ? (
    <div className='flex flex-col md:flex-row px-6 md:px-16 lg:px-40 py-30 md:pt-50'>
      
      {/* Cột trái: Khung giờ chiếu */}
      <div className='w-64 bg-primary/10 border border-primary/20 rounded-lg py-8 h-max md:sticky md:top-30'>
        <p className='text-lg font-semibold px-6 mb-6'>Khung giờ chiếu</p>
        <div className='mt-2 space-y-6'>
          {show.dateTime[date] && Object.entries(
              show.dateTime[date].reduce((acc, item) => {
                  if (!acc[item.roomName]) acc[item.roomName] = [];
                  acc[item.roomName].push(item);
                  return acc;
              }, {})
          ).map(([roomName, timings]) => (
              <div key={roomName} className='flex flex-col'>
                  <p className='text-xs font-bold text-gray-500 px-6 mb-2 uppercase tracking-wider'>{roomName}</p>
                  <div className='space-y-1'>
                      {timings.map((item) => (
                          <div 
                              key={item.showId} 
                              onClick={() => setSelectedTime(item)} 
                              className={`flex items-center gap-2 px-6 py-2 w-max rounded-r-md cursor-pointer transition ${
                                  selectedTime?.showId === item.showId ? "bg-primary text-white" : "hover:bg-primary/20"
                              }`}
                          >
                              <ClockIcon className='w-4 h-4' />
                              <p className='text-sm'>{isoTimeFormat(item.time)}</p>
                          </div>
                      ))}
                  </div>
              </div>
          ))}
        </div>
      </div>

      {/* Cột phải: Sơ đồ ghế ngồi */}
      <div className='relative flex-1 max-md:mt-16 md:ml-8'>
        <BlurCircle top='-100px' left='-100px' />
        <BlurCircle bottom='0' right='0' />

        <div className='mb-6 rounded-2xl border border-primary/20 bg-primary/8 p-4 md:p-5'>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div>
              <p className='text-xs font-medium uppercase tracking-[0.22em] text-primary/80'>Đang chọn ghế</p>
              <h1 className='mt-2 text-2xl font-semibold text-white'>{movieTitle}</h1>
              <div className='mt-3 flex flex-wrap gap-2 text-sm text-gray-300'>
                <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5'>
                  <CalendarDaysIcon className='h-4 w-4 text-primary' />
                  {selectedShowDate || date}
                </span>
                <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5'>
                  <ClockIcon className='h-4 w-4 text-primary' />
                  {selectedTime ? isoTimeFormat(selectedTime.time) : 'Chưa chọn giờ'}
                </span>
                <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5'>
                  <MapPinIcon className='h-4 w-4 text-primary' />
                  {roomData?.roomName || selectedTime?.roomName || 'Chưa có phòng'}
                </span>
                {movie?.runtime && (
                  <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5'>
                    <ClockIcon className='h-4 w-4 text-primary' />
                    {timeFormat(movie.runtime)}
                  </span>
                )}
              </div>
            </div>
            <div className='grid grid-cols-3 gap-3 text-center text-xs text-gray-400 md:min-w-72'>
              <div className='rounded-xl border border-white/10 bg-black/15 px-3 py-3'>
                <p className='text-lg font-semibold text-white'>{seatStats.capacity}</p>
                <p>Tổng ghế</p>
              </div>
              <div className='rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-3'>
                <p className='text-lg font-semibold text-emerald-300'>{seatStats.available}</p>
                <p>Còn trống</p>
              </div>
              <div className='rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-3'>
                <p className='text-lg font-semibold text-rose-300'>{seatStats.sold}</p>
                <p>Đã bán</p>
              </div>
            </div>
          </div>
        </div>

        <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start'>
          <div className='p-0 md:p-2'>
            <div className='flex flex-col items-center'>
              <img src={assets.screenImage} alt="Màn hình chiếu" className='mt-2 max-w-full' />
              <p className='text-gray-400 text-sm mb-6 mt-2 tracking-[0.3em]'>MÀN HÌNH</p>
            </div>

            <div className='flex flex-col items-center mt-8 text-xs text-gray-300 w-full overflow-x-auto pb-6'>
              {seatMap?.map((rowObj) => {
                if (rowObj.seats.length === 0) return <div key={rowObj.row} className="h-3 md:h-6 w-full"></div>; 
                return (
                  <div key={rowObj.row} className='flex gap-2 mt-3 items-center justify-center w-full min-w-max'>
                    <div className='w-6 text-center font-bold text-gray-500 mr-2 md:mr-4'>{rowObj.row}</div>
                    <div className='flex items-center justify-center gap-2 md:gap-3'>
                      {rowObj.seats.map((seat) => {
                        if (seat.seatType === 'EMPTY') return <div key={seat.seatNumber} className='w-6 md:w-8 h-8'></div>;

                        let styleClass = 'border-primary/60 hover:bg-primary/20 text-white'; 
                        let widthClass = 'w-8 h-8 md:w-10 md:h-10';

                        if (seat.seatType === 'VIP') {
                          styleClass = 'border-yellow-500 hover:bg-yellow-500/20 text-white';
                        } else if (seat.seatType === 'COUPLE') {
                          styleClass = 'border-pink-500 hover:bg-pink-500/20 text-white';
                          widthClass = 'w-16 h-8 md:w-18 md:h-10'; 
                        }

                        const isSelected = selectedSeats.includes(seat.seatNumber);
                        const isOccupied = occupiedSeats.includes(seat.seatNumber);
                        const isHeld = heldSeats.includes(seat.seatNumber);
                        const isLiveViewing = liveViewingSeats.includes(seat.seatNumber);

                        return (
                          <button
                            key={seat.seatNumber}
                            onClick={() => handleSeatClick(seat.seatNumber)}
                            disabled={isOccupied || isHeld || isLiveViewing}
                            className={`rounded border cursor-pointer transition-all duration-200 flex items-center justify-center font-medium
                              ${widthClass} ${styleClass}
                              ${isSelected ? "bg-primary! text-white! border-primary! scale-110" : ""}
                              ${isOccupied ? "opacity-30! cursor-not-allowed! bg-gray-800! border-gray-600! text-gray-500!" : ""}
                              ${isHeld ? "bg-orange-500/60! border-orange-500! text-white! cursor-not-allowed! animate-pulse" : ""}
                              ${isLiveViewing ? "border-red-500! text-red-500! bg-red-500/10! cursor-wait! animate-pulse" : ""}
                            `}
                          >
                            {seat.seatNumber}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {seatMap.length > 0 && (
              <div className='mt-6 space-y-5 border-t border-white/10 pt-5'>
                <div>
                  <p className='mb-3 text-sm font-medium text-white'>Chú thích ghế</p>
                  <div className='flex flex-wrap gap-3 text-xs text-gray-400'>
                    <div className='flex items-center gap-2'><div className='w-4 h-4 border border-primary/60 rounded'></div> Tiêu chuẩn</div>
                    <div className='flex items-center gap-2'><div className='w-4 h-4 border border-yellow-500 rounded'></div> VIP</div>
                    <div className='flex items-center gap-2'><div className='w-8 h-4 border border-pink-500 rounded'></div> Ghế đôi</div>
                    <div className='flex items-center gap-2'><div className='w-4 h-4 bg-primary border border-primary rounded'></div> Đang chọn</div>
                    <div className='flex items-center gap-2'><div className='w-4 h-4 border border-red-500 bg-red-500/10 rounded animate-pulse'></div> Người khác đang chọn</div>
                    <div className='flex items-center gap-2'><div className='w-4 h-4 bg-orange-500/60 border border-orange-500 rounded animate-pulse'></div> Chờ thanh toán</div>
                    <div className='flex items-center gap-2'><div className='w-4 h-4 bg-gray-800 rounded'></div> Đã bán</div>
                  </div>
                </div>
                <div>
                  <p className='mb-3 text-sm font-medium text-white'>Bảng giá</p>
                  <div className='max-w-sm space-y-2 rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-gray-300'>
                    <p className='flex justify-between'><span>Tiêu chuẩn</span><span>{formatMoney(basePrice, currency)}</span></p>
                    <p className='flex justify-between'><span>VIP</span><span>{formatMoney(basePrice + 20000, currency)}</span></p>
                    <p className='flex justify-between'><span>Ghế đôi</span><span>{formatMoney(basePrice * 2, currency)}</span></p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className='rounded-2xl border border-primary/20 bg-primary/8 p-4 text-sm text-gray-300 xl:sticky xl:top-28'>
            <div className='flex items-center gap-2 text-white'>
              <TicketIcon className='h-5 w-5 text-primary' />
              <p className='font-semibold'>Tóm tắt đặt vé</p>
            </div>

            <div className='mt-4 space-y-3 rounded-xl border border-white/10 bg-black/15 p-3'>
              <p className='flex justify-between gap-3'><span className='text-gray-400'>Phim</span><span className='text-right text-white'>{movieTitle}</span></p>
              <p className='flex justify-between gap-3'><span className='text-gray-400'>Suất chiếu</span><span>{selectedTime ? isoTimeFormat(selectedTime.time) : '-'}</span></p>
              <p className='flex justify-between gap-3'><span className='text-gray-400'>Phòng</span><span>{roomData?.roomName || selectedTime?.roomName || '-'}</span></p>
            </div>

            <div className='mt-4'>
              <p className='mb-2 text-xs font-medium uppercase tracking-[0.2em] text-primary/80'>Ghế đã chọn</p>
              {selectedSeatDetails.length > 0 ? (
                <div className='space-y-2'>
                  {selectedSeatDetails.map((seat) => (
                    <div key={seat.seatNumber} className='flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2'>
                      <span className='font-medium text-white'>{seat.seatNumber}</span>
                      <span className='text-xs text-gray-400'>{seat.label}</span>
                      <span>{formatMoney(seat.unitPrice, currency)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-gray-500'>
                  Chưa chọn ghế
                </div>
              )}
            </div>

            {concessions.length > 0 && (
              <div className='mt-4 rounded-xl border border-white/10 bg-white/5 p-3'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2 text-white'>
                      <PopcornIcon className='h-4 w-4 text-primary' />
                      <p className='font-medium'>Đồ ăn & nước</p>
                    </div>
                    <p className='mt-1 text-xs text-gray-400'>
                      {concessionItemCount > 0
                        ? `${concessionItemCount} món - ${formatMoney(concessionTotal, currency)}`
                        : 'Mua thêm bắp, nước hoặc combo'}
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={() => setIsConcessionModalOpen(true)}
                    className='shrink-0 rounded-full border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10'
                  >
                    {concessionItemCount > 0 ? 'Đổi món' : 'Chọn món'}
                  </button>
                </div>
              </div>
            )}

            <div className='mt-4 rounded-xl border border-white/10 bg-black/15 p-3'>
              <div className='flex items-center justify-between gap-4'>
                <div className='flex items-center gap-2'>
                  <WalletIcon className='h-4 w-4 text-primary' />
                  <div>
                    <p className='font-medium text-white'>Ví QuickShow</p>
                    <p className='text-xs text-gray-400'>Số dư: {formatMoney(walletBalance, currency)}</p>
                  </div>
                </div>
                <label className='inline-flex items-center gap-2 text-xs text-gray-200'>
                  <input
                    type='checkbox'
                    checked={useWallet}
                    onChange={(event) => setUseWallet(event.target.checked)}
                    disabled={walletBalance <= 0}
                    className='h-4 w-4 accent-primary'
                  />
                  Dùng ví
                </label>
              </div>
              {useWallet && walletAmountUsed > 0 && (
                <div className='mt-3 space-y-1 border-t border-white/10 pt-3 text-xs'>
                  <p className='flex justify-between'><span>Trừ từ ví</span><span>{formatMoney(walletAmountUsed, currency)}</span></p>
                  <p className='flex justify-between'><span>Còn thanh toán {paymentProviderLabel}</span><span>{formatMoney(stripeAmount, currency)}</span></p>
                </div>
              )}
            </div>

            {stripeAmount > 0 && (
              <div className='mt-4 rounded-xl border border-white/10 bg-black/15 p-3'>
                <p className='mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary/80'>Phương thức thanh toán</p>
                <div className='grid grid-cols-2 gap-2'>
                  {paymentMethods.map(({ value, label, description, Icon }) => {
                    const isSelected = paymentProvider === value

                    return (
                      <button
                        key={value}
                        type='button'
                        onClick={() => setPaymentProvider(value)}
                        className={`flex min-h-20 flex-col items-start justify-center rounded-xl border px-3 py-3 text-left transition ${
                          isSelected
                            ? 'border-primary bg-primary/15 text-white'
                            : 'border-white/10 bg-white/5 text-gray-300 hover:border-primary/40'
                        }`}
                      >
                        <span className='flex items-center gap-2 text-sm font-medium'>
                          <Icon className='h-4 w-4 text-primary' />
                          {label}
                        </span>
                        <span className='mt-1 text-xs text-gray-400'>{description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className='mt-4 space-y-2 border-t border-white/10 pt-4'>
              <p className='flex justify-between'><span>Tiền vé</span><span>{formatMoney(ticketTotal, currency)}</span></p>
              {concessionTotal > 0 && (
                <p className='flex justify-between'><span>Đồ ăn & nước</span><span>{formatMoney(concessionTotal, currency)}</span></p>
              )}
              <p className='flex justify-between'><span>Tạm tính</span><span>{formatMoney(totalPrice, currency)}</span></p>
              <p className='flex justify-between text-lg font-semibold text-white'><span>Tổng thanh toán</span><span>{formatMoney(stripeAmount, currency)}</span></p>
            </div>

            <div className='mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-gray-400'>
              <p className='mb-1 flex items-center gap-2 font-medium text-gray-200'><InfoIcon className='h-4 w-4 text-primary' /> Lưu ý</p>
              <p>Chọn tối đa 5 ghế mỗi giao dịch. Ghế được giữ 30 phút khi thanh toán Stripe và 10 phút khi thanh toán ZaloPay. Vé đã thanh toán có thể hủy trước giờ chiếu ít nhất 24 giờ.</p>
            </div>

            <button onClick={bookTickets} className='mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium transition hover:bg-primary-dull active:scale-95'>
              {stripeAmount === 0 && selectedSeats.length > 0 ? 'Thanh toán bằng ví' : `Thanh toán qua ${paymentProviderLabel}`}
              <ArrowRightIcon strokeWidth={3} className='h-4 w-4' />
            </button>
          </aside>
        </div>

        {isConcessionModalOpen && (
          <div
            className='fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm'
            onMouseDown={() => setIsConcessionModalOpen(false)}
          >
            <div
              className='flex max-h-[calc(100vh-48px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-primary/20 bg-[#11131c] shadow-[0_30px_100px_rgba(0,0,0,0.55)]'
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className='flex items-start justify-between gap-4 border-b border-white/10 p-5'>
                <div>
                  <div className='flex items-center gap-2 text-white'>
                    <PopcornIcon className='h-5 w-5 text-primary' />
                    <h2 className='text-lg font-semibold'>Đồ ăn & nước</h2>
                  </div>
                  <p className='mt-1 text-sm text-gray-400'>Chọn món mua kèm, số tiền sẽ cộng vào tổng thanh toán.</p>
                </div>
                <button
                  type='button'
                  onClick={() => setIsConcessionModalOpen(false)}
                  className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white'
                  aria-label='Đóng chọn đồ ăn'
                >
                  <XIcon className='h-5 w-5' />
                </button>
              </div>

              <div className='overflow-y-auto p-5'>
                <div className='grid gap-3 md:grid-cols-2'>
                  {concessions.map((item) => {
                    const quantity = Number(concessionQuantities[item._id] || 0)
                    const canIncrease = quantity < MAX_CONCESSION_PER_ITEM && concessionItemCount < MAX_CONCESSION_TOTAL

                    return (
                      <div key={item._id} className='rounded-xl border border-white/10 bg-white/5 p-4'>
                        <div className='flex min-h-28 flex-col justify-between gap-4'>
                          <div className='flex gap-3'>
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className='h-24 w-24 shrink-0 rounded-xl object-cover'
                                loading='lazy'
                              />
                            ) : (
                              <div className='flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-primary'>
                                <PopcornIcon className='h-8 w-8' />
                              </div>
                            )}
                            <div className='min-w-0 flex-1'>
                              <div className='flex items-start justify-between gap-3'>
                                <div className='min-w-0'>
                                  <p className='font-medium text-white'>{item.name}</p>
                                  {item.description && (
                                    <p className='mt-1 line-clamp-2 text-xs leading-5 text-gray-400'>{item.description}</p>
                                  )}
                                </div>
                                <p className='shrink-0 text-sm font-semibold text-primary'>{formatMoney(item.price, currency)}</p>
                              </div>
                            </div>
                          </div>

                          <div className='flex items-center justify-between gap-3'>
                            <p className='text-xs text-gray-500'>Tối đa 3 mỗi món, tổng 10 món</p>
                            <div className='flex shrink-0 items-center gap-2'>
                              <button
                                type='button'
                                onClick={() => updateConcessionQuantity(item._id, -1)}
                                disabled={quantity <= 0}
                                className='flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40'
                                aria-label={`Giảm ${item.name}`}
                              >
                                <MinusIcon className='h-4 w-4' />
                              </button>
                              <span className='w-6 text-center text-sm font-semibold text-white'>{quantity}</span>
                              <button
                                type='button'
                                onClick={() => updateConcessionQuantity(item._id, 1)}
                                disabled={!canIncrease}
                                className='flex h-9 w-9 items-center justify-center rounded-full border border-primary/50 text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40'
                                aria-label={`Tăng ${item.name}`}
                              >
                                <PlusIcon className='h-4 w-4' />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className='border-t border-white/10 p-5'>
                <div className='mb-4 flex items-center justify-between gap-4 text-sm'>
                  <span className='text-gray-400'>Đã chọn {concessionItemCount}/{MAX_CONCESSION_TOTAL} món</span>
                  <span className='text-lg font-semibold text-white'>{formatMoney(concessionTotal, currency)}</span>
                </div>
                <div className='flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
                  <button
                    type='button'
                    onClick={clearConcessions}
                    disabled={concessionItemCount === 0}
                    className='rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40'
                  >
                    Xóa món đã chọn
                  </button>
                  <button
                    type='button'
                    onClick={() => setIsConcessionModalOpen(false)}
                    className='rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dull'
                  >
                    Xong
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  ) : (
    <Loading />
  )
}

export default SeatLayout
