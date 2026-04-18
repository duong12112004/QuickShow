import React, { useEffect, useState } from 'react'
import Title from '../../components/admin/Title'
import { CheckIcon, DeleteIcon, StarIcon } from 'lucide-react'
import { kConverter } from '../../lib/kConverter'
import toast from 'react-hot-toast'
import { useAppContext } from '../../context/AppContext'

const AddShow = () => {
  const { axios, getToken, user, image_base_url } = useAppContext()
  const currency = import.meta.env.VITE_CURRENCY
  
  const [nowPlayingMovies, setNowPlayingMovies] = useState([])
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [rooms, setRooms] = useState([]) 
  const [selectedRoom, setSelectedRoom] = useState("") 
  const [dateTimeSelection, setDateTimeSelection] = useState({})
  const [dateTimeInput, setDateTimeInput] = useState("")
  const [basePrice, setBasePrice] = useState("") 
  const [addingShow, setAddingShow] = useState(false)

  // API lấy danh sách phim đang chiếu từ TMDB
  const fetchNowPlayingMovies = async () => {
    try {
      const { data } = await axios.get('/api/show/now-playing', {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });
      if (data.success) setNowPlayingMovies(data.movies);
    } catch (error) { console.error('Lỗi khi tải danh sách phim:', error); }
  };

  // API lấy danh sách phòng chiếu đã thiết lập trong Database
  const fetchRooms = async () => {
    try {
      const { data } = await axios.get('/api/admin/rooms', {
        headers: { Authorization: `Bearer ${await getToken()}` } 
      });
      if (data.success) setRooms(data.rooms);
    } catch (error) { console.error('Lỗi khi tải danh sách phòng chiếu:', error); }
  }

  // Thêm mốc thời gian chiếu vào danh sách chuẩn bị submit
  const handleDateTimeAdd = () => {
    if (!dateTimeInput) return;
    const [date, time] = dateTimeInput.split("T")
    if (!date || !time) return;

    setDateTimeSelection((prev) => {
      const times = prev[date] || [];
      if (!times.includes(time)) {
        return { ...prev, [date]: [...times, time] };
      }
      return prev;
    })
  }

  // Xóa mốc thời gian chiếu đã chọn
  const handlRemoveTime = (date, time) => {
    setDateTimeSelection((prev) => {
      const filteredTimes = prev[date].filter((t) => t !== time);
      if (filteredTimes.length === 0) {
        const { [date]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [date]: filteredTimes }
    })
  }

  // Gửi dữ liệu tạo suất chiếu lên Server
  const handleSubmit = async () => {
    try {
      setAddingShow(true);

      // Validate dữ liệu đầu vào
      if (!selectedMovie || !selectedRoom || Object.keys(dateTimeSelection).length === 0 || !basePrice) {
        setAddingShow(false);
        return toast.error('Vui lòng điền đầy đủ thông tin (Phim, Phòng, Ngày giờ, Giá gốc)');
      }

      const showsInput = Object.entries(dateTimeSelection).map(([date, time]) => ({ date, time }));

      const payload = {
        movieId: selectedMovie,
        roomId: selectedRoom, 
        showsInput,
        basePrice: Number(basePrice) 
      };

      const { data } = await axios.post('/api/show/add', payload, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });

      if (data.success) {
        toast.success(data.message);
        // Reset form sau khi thêm thành công
        setSelectedMovie(null);
        setSelectedRoom("");
        setDateTimeSelection({});
        setBasePrice("");
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.');
    } finally {
      setAddingShow(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNowPlayingMovies();
      fetchRooms(); 
    }
  }, [user])

  return (
    <>
      <Title text1="Thêm" text2='Suất chiếu' />
      
      {/* Khối chọn Phim */}
      <p className='mt-10 text-lg font-medium'>Danh sách phim đang chiếu</p>
      <div className='overflow-x-auto pb-4'>
        <div className='group flex flex-wrap gap-4 mt-4 w-max '>
          {nowPlayingMovies.map((movie) => (
            <div onClick={() => setSelectedMovie(movie.id)} key={movie.id} className={`relative max-w-40 cursor-pointer group-hover:not-hover:opacity-40 hover:-translate-y-1 transition duration-300`} >
              <div className='relative rounded-lg overflow-hidden'>
                <img src={image_base_url + movie.poster_path} alt='' className='w-full object-cover brightness-90' />
                <div className='text-sm flex items-center justify-between p-2 bg-black/70 w-full absolute bottom-0 left-0'>
                  <p className='flex items-center gap-1 text-gray-400'>
                    <StarIcon className='w-4 h-4 text-primary fill-primary' />
                    {movie.vote_average ? movie.vote_average.toFixed(1) : "0.0"}
                  </p>
                  <p className='text-gray-300'>
                    {movie.vote_count ? kConverter(movie.vote_count) : 0} Votes
                  </p>
                </div>
              </div>
              {selectedMovie === movie.id && (
                <div className='absolute top-2 right-2 flex items-center justify-center bg-primary h-6 w-6 rounded'>
                  <CheckIcon className='w-4 h-4 text-white' strokeWidth={2.5} />
                </div>
              )}
              <p className='font-medium truncate'>{movie.title}</p>
              <p className='text-gray-400 text-sm'>Khởi chiếu: {movie.release_date}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Khối chọn Phòng chiếu */}
      <div className='mt-8'>
        <label className='block text-sm font-medium mb-2'>Chọn phòng chiếu</label>
        <select 
          value={selectedRoom} 
          onChange={(e) => setSelectedRoom(e.target.value)} 
          className='bg-transparent border border-gray-600 px-3 py-2 rounded-md outline-none w-full max-w-md text-white'
        >
          <option value="" className='bg-black text-gray-400'>-- Vui lòng chọn một phòng chiếu --</option>
          {rooms.map(room => (
            <option key={room._id} value={room._id} className='bg-black'>
                {room.name} ({room.roomType})
            </option>
          ))}
        </select>
      </div>

      {/* Khối cấu hình Giá vé cơ bản */}
      <div className='mt-6'>
        <label className='block text-sm font-medium mb-2'>Giá vé tiêu chuẩn (Giá gốc)</label>
        <div className='inline-flex items-center gap-2 border border-gray-600 px-3 py-2 rounded-md'>
          <p className='text-gray-400 text-sm'>{currency}</p>
          <input min={0} type='number' value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder='Nhập giá vé gốc (VD: 85000)' className='outline-none' />
        </div>
      </div>

      {/* Khối cấu hình Lịch chiếu */}
      <div className='mt-6'>
        <label className='block text-sm font-medium mb-2'>Chọn ngày và giờ chiếu</label>
        <div className='inline-flex gap-5 border border-gray-600 p-1 pl-3 rounded-lg'>
          <input type="datetime-local" value={dateTimeInput} onChange={(e) => setDateTimeInput(e.target.value)} className='outline-none rounded-md ' />
          <button onClick={handleDateTimeAdd} className='bg-primary/80 text-white px-3 py-2 text-sm rounded-lg hover:bg-primary cursor-pointer'>
            Thêm lịch
          </button>
        </div>
      </div>
      
      {/* Hiển thị danh sách lịch chiếu đã chọn */}
      {Object.keys(dateTimeSelection).length > 0 && (
        <div className='mt-6'>
          <h2 className='mb-2 text-sm font-medium'>Các mốc thời gian đã chọn:</h2>
          <ul className='space-y-3'>
            {Object.entries(dateTimeSelection).map(([date, times]) => (
              <li key={date}>
                <div className='font-medium text-gray-300'>Ngày: {date}</div>
                <div className='flex flex-wrap gap-2 mt-1 text-sm'>
                  {times.map((time) => (
                    <div key={time} className='border border-primary px-2 py-1 flex items-center rounded'>
                      <span>{time}</span>
                      <DeleteIcon onClick={() => handlRemoveTime(date, time)} width={15} className='ml-2 text-red-500 hover:text-red-700 cursor-pointer' />
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Nút gửi dữ liệu */}
      <button onClick={handleSubmit} disabled={addingShow} className='bg-primary text-white px-8 py-2 mt-6 rounded hover:bg-primary/90 transition-all cursor-pointer'>
        {addingShow ? 'Đang xử lý...' : 'Thêm suất chiếu'}
      </button>
    </>
  )
}
export default AddShow