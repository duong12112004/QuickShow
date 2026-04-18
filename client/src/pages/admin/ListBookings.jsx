import React, { useEffect, useState } from 'react'
import Loading from '../../components/Loading'
import Title from '../../components/admin/Title'
import { dateFormat } from '../../lib/dateFormat'
import { useAppContext } from '../../context/AppContext'

const ListBookings = () => {
  const currency = import.meta.env.VITE_CURRENCY

  const { axios, getToken, user } = useAppContext()

  const [bookings, setBookings] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const getAllBookings = async () => {
    try {
        const { data } = await axios.get("/api/admin/all-bookings", {
            headers: { Authorization: `Bearer ${await getToken()}` }
        });
        setBookings(data.bookings);
    } catch (error) {
        console.error(error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if(user){
      getAllBookings();
    }
  }, [user])

  return !isLoading ? (
    <>
      <Title text1="Danh sách" text2="Đặt vé"/>
      <div className='max-w-4xl mt-6 overflow-x-auto'>
        <table className='w-full border-collapse rounded-md overflow-hidden text-nowrap'>
            <thead>
              <tr className='bg-primary/20 text-left text-white'>
                <th className='p-2 font-medium pl-5'>Người dùng</th>
                <th className='p-2 font-medium'>Tên phim</th>
                <th className='p-2 font-medium'>Lịch chiếu</th>
                <th className='p-2 font-medium'>Ghế đã đặt</th>
                <th className='p-2 font-medium'>Tổng tiền</th>
              </tr>
            </thead>
            <tbody className='text-sm font-light'>
                {bookings.map((item, index) => (
                  <tr key={index} className='border-b border-primary/20 bg-primary/5 even:bg-primary/10'>
                      <td className='p-2 min-w-45 pl-5'>{item.user?.name || "Người dùng đã xóa"}</td>
                      <td className='p-2'>{item.show?.movie?.title || "Phim đã xóa"}</td>
                      <td className='p-2'>{item.show?.showDateTime ? dateFormat(item.show.showDateTime) : "Không có dữ liệu"}</td>
                      <td className='p-2'>
                        {(item.bookedSeats && Object.keys(item.bookedSeats).length > 0) 
                          ? Object.keys(item.bookedSeats).map(seat => item.bookedSeats[seat]).join(", ") 
                          : "Trống"}
                      </td>
                      <td className='p-2 text-primary font-medium'>{(item.amount || 0).toLocaleString()} {currency}</td>
                  </tr>
                ))}
            </tbody>
        </table>
      </div>
    </>
  ) : <Loading/>
}

export default ListBookings