import React, { useEffect, useState } from 'react'
import Loading from '../components/Loading'
import BlurCircle from '../components/BlurCircle'
import timeFormat from '../lib/timeFormat'
import { dateFormat } from '../lib/dateFormat'
import { useAppContext } from '../context/AppContext'
import { Link } from 'react-router-dom'

// Component hiển thị lịch sử đặt vé của người dùng
const MyBookings = () => {

  const { axios, getToken, user, image_base_url } = useAppContext()
  const currency = import.meta.env.VITE_CURRENCY

  const [bookings, setBookings] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const getMyBookings = async () => {
    try {
        const { data } = await axios.get('/api/user/bookings', {
            headers: { Authorization: `Bearer ${await getToken()}` }
        })
        if (data.success) {
            setBookings(data.bookings)
        }
    } catch (error) {
        console.error(error)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if(user){
      getMyBookings()
    }
  }, [user])

  return !isLoading ? (
    <div className='relative px-6 md:px-16 lg:px-40 pt-30 md:pt-40 min-h-[80vh]'>
      <BlurCircle top='100px' left='100px'/>
      <div>
        <BlurCircle bottom='0px' left='600px'/>
      </div>
      
      <h1 className='text-lg font-semibold mb-4'>Vé của tôi</h1>
      
      {bookings.map((item, index) => (
        <div key={index} className='flex flex-col md:flex-row justify-between bg-primary/8 border border-primary/20 rounded-lg mt-4 p-2 max-w-3xl'>
          <div className='flex flex-col md:flex-row'>
              <img src={image_base_url + item.show.movie.poster_path} alt={item.show.movie.title} className='md:max-w-45 aspect-video h-auto object-cover object-bottom rounded'/>
              <div className='flex flex-col p-4'>
                <p className='text-lg font-semibold'>{item.show.movie.title}</p>
                <p className='text-sm text-gray-400'>{timeFormat(item.show.movie.runtime)}</p>
                <p className='text-sm mt-auto text-gray-400'>{dateFormat(item.show.showDateTime)}</p>
              </div>
          </div>

          <div className='flex flex-col md:items-end md:text-right justify-between p-4 '>
            <div className='flex items-center gap-4'>
              {/* Đưa tiền tệ ra sau số và format dấu phẩy */}
              <p className='text-xl font-semibold mb-3 text-primary'>
                {(item.amount || 0).toLocaleString()} {currency}
              </p>
              {!item.isPaid && 
              <Link to={item.paymentLink} className='bg-primary px-4 py-2 mb-3 text-sm rounded-full font-medium cursor-pointer hover:bg-primary-dull transition'>
                Thanh toán
              </Link>}
            </div>
            <div className='text-sm text-gray-300'>
                <p><span className='text-gray-400'>Tổng số vé:</span> {item.bookedSeats.length}</p>
                <p><span className='text-gray-400'>Ghế đã chọn:</span> {item.bookedSeats.join(", ")}</p>
            </div>
          </div>

        </div>
      ))}
    </div>
  ) : <Loading/>
}

export default MyBookings