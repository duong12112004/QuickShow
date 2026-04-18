import { ChartLineIcon, CircleDollarSignIcon, PlayCircleIcon, StarIcon, UserIcon } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import Loading from '../../components/Loading'
import Title from '../../components/admin/Title'
import BlurCircle from '../../components/BlurCircle'
import { dateFormat } from '../../lib/dateFormat'
import toast from 'react-hot-toast'
import { useAppContext } from '../../context/AppContext'

const DashBoard = () => {

  const { axios, getToken, user, image_base_url } = useAppContext()
  const currency = import.meta.env.VITE_CURRENCY

  const [dashboardData, setDashboardData] = useState({
    totalBookings: 0,
    totalRevenue: 0,
    activeShows: [],
    totalUser: 0
  })

  const [loading, setLoading] = useState(true)

  // Danh sách các thẻ thống kê đã được Việt hóa
  const dashboardCards = [
    { title: "Tổng số vé đặt", value: dashboardData.totalBookings || "0", icon: ChartLineIcon },
    // Dùng toLocaleString() để format tiền tệ chuẩn (VD: 100,000 thay vì 100000)
    { title: "Tổng doanh thu", value: `${(dashboardData.totalRevenue || 0).toLocaleString()} ${currency}`, icon: CircleDollarSignIcon },
    { title: "Suất chiếu mở", value: dashboardData.activeShows.length || "0", icon: PlayCircleIcon },
    { title: "Tổng người dùng", value: dashboardData.totalUser || "0", icon: UserIcon },
  ]

  // API lấy dữ liệu tổng quan cho Dashboard
  const fetchDashboardData = async () => {
    try {
        const { data } = await axios.get('/api/admin/dashboard', {
            headers: { Authorization: `Bearer ${await getToken()}` }
        });
        
        if (data.success) {
            setDashboardData(data.dashboardData);
            setLoading(false);
        } else {
            toast.error(data.message);
        }
    } catch (error) {
        toast.error('Lỗi khi tải dữ liệu tổng quan: ' + error.message);
    }
  };

  // Chỉ gọi API khi đã xác thực được thông tin User (Clerk)
  useEffect(() => {
    if (user) {
        fetchDashboardData();
    }
  }, [user]);

  return !loading ? (
    <>
      <Title text1='Tổng quan' text2='Hệ thống'/>

      {/* Khối các thẻ thống kê (Thẻ thông tin) */}
      <div className='relative flex flex-wrap gap-4 mt-6'>
          <BlurCircle top='-100px' left='0'/>
          <div className='flex flex-wrap gap-4 w-full'>
              {dashboardCards.map((card, index) => (
                <div key={index} className='flex items-center justify-between px-4 py-3 bg-primary/10 border border-primary/20 rounded-md max-w-50 w-full'>
                    <div>
                      <h1 className='text-sm text-gray-300'>{card.title}</h1>
                      <p className='text-xl font-medium mt-1'>{card.value}</p>
                    </div>
                    <card.icon className='w-6 h-6 text-gray-400'/>
                </div>
              ))}
          </div>
      </div>
      
      <p className='mt-10 text-lg font-medium'>Danh sách suất chiếu đang mở</p>

      {/* Khối hiển thị danh sách các phim đang có suất chiếu */}
      <div className='relative flex flex-wrap gap-6 mt-4 max-w-5xl'>
            <BlurCircle top='100px' left='-10%'/>
            {dashboardData.activeShows.map((show) => (
              <div key={show._id} className='w-55 rounded-lg overflow-hidden h-full pb-3 bg-primary/10 border border-primary/20 hover:-translate-y-1 transition duration-300'>
                <img src={image_base_url + show.movie.poster_path} alt={show.movie.title} className='h-60 w-full object-cover'/>
                <p className='font-medium p-2 truncate' title={show.movie.title}>{show.movie.title}</p>
                
                <div className='flex items-center justify-between px-2'>
                  <p className='text-base font-medium text-primary'>{(show.basePrice || 0).toLocaleString()} {currency}</p>
                  <p className='flex items-center gap-1 text-sm text-gray-400 mt-1 pr-1'>
                    <StarIcon className='w-4 h-4 text-primary fill-primary'/>
                    {show.movie.vote_average ? show.movie.vote_average.toFixed(1) : "0.0"}
                  </p>
                </div>
                
                {/* Dùng hàm dateFormat đã Việt hóa ở bước trước */}
                <p className='px-2 pt-2 text-sm text-gray-500'>Lịch chiếu: {dateFormat(show.showDateTime)}</p>
              </div>
            ))}
      </div>
    </>
  ) : <Loading/>
}

export default DashBoard