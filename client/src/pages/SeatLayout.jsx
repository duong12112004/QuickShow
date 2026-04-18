import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { assets } from '../assets/assets'
import Loading from '../components/Loading'
import { ArrowRightIcon, ClockIcon } from 'lucide-react'
import isoTimeFormat from '../lib/isoTimeFormat'
import toast from 'react-hot-toast'
import BlurCircle from '../components/BlurCircle'
import { useAppContext } from '../context/AppContext'
import { socket } from '../configs/socket';

// Component hiển thị sơ đồ ghế ngồi và xử lý luồng đặt vé Real-time
const SeatLayout = () => {
  const { id, date } = useParams()
  const [selectedSeats, setSelectedSeats] = useState([])
  const [selectedTime, setSelectedTime] = useState(null)
  const [show, setShow] = useState(null)

  const [seatMap, setSeatMap] = useState([])
  const [heldSeats, setHeldSeats] = useState([])
  const [occupiedSeats, setOccupiedSeats] = useState([])
  const [roomData, setRoomData] = useState(null) 
  const [basePrice, setBasePrice] = useState(0)

  // Quản lý trạng thái ghế đang được người dùng khác click xem (Real-time)
  const [liveViewingSeats, setLiveViewingSeats] = useState([])

  const { axios, getToken, user } = useAppContext()
  const currency = import.meta.env.VITE_CURRENCY

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
        selectedSeats
      }, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      })

      if (data.success) {
        window.location.href = data.url;
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
      if (sType === 'VIP') total += (basePrice + 20000);
      else if (sType === 'COUPLE') total += (basePrice * 2);
      else total += basePrice;
    });
    return total;
  };

  useEffect(() => { getShow() }, [])

  useEffect(() => {
    if (selectedTime) {
      getSeatLayout()
      setSelectedSeats([]) 
      setLiveViewingSeats([]) // Reset mảng quan sát live khi chuyển suất chiếu
    }
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
      <div className='relative flex-1 flex flex-col items-center max-md:mt-16'>
        <BlurCircle top='-100px' left='-100px' />
        <BlurCircle bottom='0' right='0' />

        {roomData && (
          <div className='text-center mb-4'>
            <p className='text-primary text-lg font-semibold'>{roomData.roomName}</p>
          </div>
        )}

        <img src={assets.screenImage} alt="Màn hình chiếu" className='mt-2' />
        <p className='text-gray-400 text-sm mb-6 mt-2 tracking-[0.3em]'>MÀN HÌNH</p>

        <div className='flex flex-col items-center mt-8 text-xs text-gray-300 w-full overflow-x-auto pb-10'>
          {seatMap?.map((rowObj, index) => {
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
                          
                          /* Hiệu ứng viền đỏ nhấp nháy khi người khác đang bấm */
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

        {/* Chú thích các loại ghế (Legend) */}
        {seatMap.length > 0 && (
          <div className='flex flex-wrap gap-4 md:gap-6 mt-10 text-sm text-gray-400 justify-center'>
            <div className='flex items-center gap-2'><div className='w-4 h-4 border border-primary/60 rounded'></div> Tiêu chuẩn</div>
            <div className='flex items-center gap-2'><div className='w-4 h-4 border border-yellow-500 rounded'></div> VIP</div>
            <div className='flex items-center gap-2'><div className='w-8 h-4 border border-pink-500 rounded'></div> Ghế đôi</div>
            
            <div className='flex items-center gap-2'><div className='w-4 h-4 border border-red-500 bg-red-500/10 rounded animate-pulse'></div> Đang có người chọn</div>
            <div className='flex items-center gap-2'><div className='w-4 h-4 bg-orange-500/60 border border-orange-500 rounded animate-pulse'></div> Chờ thanh toán</div>
            <div className='flex items-center gap-2'><div className='w-4 h-4 bg-gray-800 rounded'></div> Đã bán</div>
          </div>
        )}

        <button onClick={bookTickets} className='flex items-center gap-2 mt-12 px-10 py-3 text-sm bg-primary hover:bg-primary-dull transition rounded-full font-medium cursor-pointer active:scale-95'>
          Tiến hành thanh toán
          {selectedSeats.length > 0 && ` | ${calculateTotalPrice().toLocaleString()} ${currency}`}
          <ArrowRightIcon strokeWidth={3} className='h-4 w-4 ml-2' />
        </button>
      </div>
    </div>
  ) : (
    <Loading />
  )
}

export default SeatLayout