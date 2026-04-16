import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { assets } from '../assets/assets'
import Loading from '../components/Loading'
import { ArrowRightIcon, ClockIcon } from 'lucide-react'
import isoTimeFormat from '../lib/isoTimeFormat'
import toast from 'react-hot-toast'
import BlurCircle from '../components/BlurCircle'
import { useAppContext } from '../context/AppContext'

const SeatLayout = () => {
  const { id, date } = useParams()
  const [selectedSeats, setSelectedSeats] = useState([])
  const [selectedTime, setSelectedTime] = useState(null)
  const [show, setShow] = useState(null)

  // Các State phục vụ Layout động
  const [seatMap, setSeatMap] = useState([])
  const [heldSeats, setHeldSeats] = useState([])
  const [occupiedSeats, setOccupiedSeats] = useState([])
  const [roomData, setRoomData] = useState(null) 
  const [basePrice, setBasePrice] = useState(0)

  const { axios, getToken, user } = useAppContext()

  const getShow = async () => {
    try {
      const { data } = await axios.get(`/api/show/${id}`)
      if (data.success) setShow(data)
    } catch (error) { console.log(error) }
  }

  // Lấy Layout phòng chiếu từ Backend
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

  const handleSeatClick = (seatId) => {
    if (!selectedTime) return toast("Please select time first")
    if (!selectedSeats.includes(seatId) && selectedSeats.length >= 5) {
      return toast("You can only select up to 5 seats")
    }
    // Khóa không cho chọn nếu ghế đã bán hoặc đang được giữ
    if (occupiedSeats.includes(seatId) || heldSeats.includes(seatId)) return toast('This seat is unavailable')

    setSelectedSeats(prev => prev.includes(seatId) ? prev.filter(seat => seat !== seatId) : [...prev, seatId])
  }

  const bookTickets = async () => {
    try {
      if (!user) return toast.error('Please login to proceed')
      if (!selectedTime || !selectedSeats.length) return toast.error('Please select a time and seats')

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
    } catch (error) { toast.error(error.message) }
  }

  // Tính tổng tiền dựa trên loại ghế
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
    }
  }, [selectedTime])

  return show ? (
    <div className='flex flex-col md:flex-row px-6 md:px-16 lg:px-40 py-30 md:pt-50'>
      
      {/* CỘT BÊN TRÁI: Thời gian có sẵn gộp theo Phòng */}
      <div className='w-64 bg-primary/10 border border-primary/20 rounded-lg py-8 h-max md:sticky md:top-30'>
        <p className='text-lg font-semibold px-6 mb-6'>Available Timings</p>
        <div className='mt-2 space-y-6'>
          {show.dateTime[date] && Object.entries(
              show.dateTime[date].reduce((acc, item) => {
                  if (!acc[item.roomName]) acc[item.roomName] = [];
                  acc[item.roomName].push(item);
                  return acc;
              }, {})
          ).map(([roomName, timings]) => (
              <div key={roomName} className='flex flex-col'>
                  <p className='text-xs font-bold text-gray-500 px-6 mb-2 uppercase tracking-wider'>
                    {roomName}
                  </p>
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

      {/* CỘT BÊN PHẢI: Bố trí chỗ ngồi động */}
      <div className='relative flex-1 flex flex-col items-center max-md:mt-16'>
        <BlurCircle top='-100px' left='-100px' />
        <BlurCircle bottom='0' right='0' />

        {roomData && (
          <div className='text-center mb-4'>
            <p className='text-primary text-lg font-semibold'>{roomData.roomName}</p>
          </div>
        )}

        <img src={assets.screenImage} alt="" className='mt-2' />
        <p className='text-gray-400 text-sm mb-6 mt-2 tracking-[0.3em]'>SCREEN</p>

        {/* Ma trận ghế vẽ tự động */}
        <div className='flex flex-col items-center mt-8 text-xs text-gray-300 w-full overflow-x-auto pb-10'>
          {seatMap?.map((rowObj, index) => {
            
            // Tạo khoảng trống dọc (Bắt tín hiệu từ Backend)
            if (rowObj.seats.length === 0) {
              return <div key={rowObj.row} className="h-3 md:h-6 w-full"></div>; 
            }

            return (
              <div key={rowObj.row} className='flex gap-2 mt-3 items-center justify-center w-full min-w-max'>
                {/* Tên hàng */}
                <div className='w-6 text-center font-bold text-gray-500 mr-2 md:mr-4'>{rowObj.row}</div>
                
                <div className='flex items-center justify-center gap-2 md:gap-3'>
                  {rowObj.seats.map((seat) => {
                    // Lối đi ngang
                    if (seat.seatType === 'EMPTY') {
                      return <div key={seat.seatNumber} className='w-6 md:w-8 h-8'></div>;
                    }

                    // Style mặc định: Màu chữ trắng 
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

                    return (
                      <button
                        key={seat.seatNumber}
                        onClick={() => handleSeatClick(seat.seatNumber)}
                        disabled={isOccupied || isHeld}
                        className={`rounded border cursor-pointer transition-all duration-200 flex items-center justify-center font-medium
                          ${widthClass} ${styleClass}
                          ${isSelected ? "!bg-primary !text-white !border-primary scale-110" : ""}
                          ${isOccupied ? "!opacity-30 !cursor-not-allowed !bg-gray-800 !border-gray-600 !text-gray-500" : ""}
                          ${isHeld ? "!bg-orange-500/60 !border-orange-500 !text-white !cursor-not-allowed animate-pulse" : ""}
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

        {/* Legend (Đã cập nhật Holding màu cam nhấp nháy) */}
        {seatMap.length > 0 && (
          <div className='flex flex-wrap gap-4 md:gap-6 mt-10 text-sm text-gray-400 justify-center'>
            <div className='flex items-center gap-2'><div className='w-4 h-4 border border-primary/60 rounded'></div> Standard</div>
            <div className='flex items-center gap-2'><div className='w-4 h-4 border border-yellow-500 rounded'></div> VIP</div>
            <div className='flex items-center gap-2'><div className='w-8 h-4 border border-pink-500 rounded'></div> Couple</div>
            <div className='flex items-center gap-2'><div className='w-4 h-4 bg-orange-500/60 border border-orange-500 rounded animate-pulse'></div> Holding</div>
            <div className='flex items-center gap-2'><div className='w-4 h-4 bg-gray-800 rounded'></div> Booked</div>
          </div>
        )}

        <button onClick={bookTickets} className='flex items-center gap-2 mt-12 px-10 py-3 text-sm bg-primary hover:bg-primary-dull transition rounded-full font-medium cursor-pointer active:scale-95'>
          Proceed to Checkout
          {selectedSeats.length > 0 && ` | ${calculateTotalPrice().toLocaleString()} đ`}
          <ArrowRightIcon strokeWidth={3} className='h-4 w-4 ml-2' />
        </button>
      </div>
    </div>
  ) : (
    <Loading />
  )
}

export default SeatLayout