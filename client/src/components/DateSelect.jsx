import React, { useState } from 'react'
import BlurCircle from './BlurCircle'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const DateSelect = ({ dateTime, id }) => {

    const navigate = useNavigate()
    const [selected, setSelected] = useState(null)

    // Xử lý logic khi người dùng nhấn nút Đặt vé
    const onBookHandler = () => {
        if (!selected) {
            return toast.error('Vui lòng chọn một ngày xem phim!')
        }
        navigate(`/movies/${id}/${selected}`)
        scrollTo(0, 0)
    }

  return (
    <div id='dateSelect' className='pt-30'>
      <div className='flex flex-col md:flex-row items-center justify-between gap-10 relative p-8 bg-primary/10 border border-primary/20 rounded-lg'>
        <BlurCircle top='-100px' left='-100px'/>
        <BlurCircle top='100px' right='0px'/>
        
        <div>
            <p className='text-lg font-semibold'>Chọn ngày xem</p>
            <div className='flex items-center gap-6 text-sm mt-5'>
                <ChevronLeftIcon width={28} className='cursor-pointer text-gray-400 hover:text-white'/>
                <span className='grid grid-cols-3 md:flex flex-wrap md:max-w-lg gap-4'>
                    {Object.keys(dateTime).map((date) => (
                        <button 
                            onClick={() => setSelected(date)} 
                            key={date} 
                            className={`flex flex-col items-center justify-center h-14 w-14 aspect-square rounded cursor-pointer transition-all ${selected === date ? "bg-primary text-white" : "border border-primary/70 text-gray-300 hover:bg-primary/20"}`}
                        >
                            <span className='text-lg font-medium'>{new Date(date).getDate()}</span>
                            {/* Định dạng tháng sang tiếng Việt */}
                            <span className='text-xs'>Thg {new Date(date).getMonth() + 1}</span>
                        </button>
                    ))}
                </span>
                <ChevronRightIcon width={28} className='cursor-pointer text-gray-400 hover:text-white'/>
            </div>
        </div>
        
        <button 
            onClick={onBookHandler} 
            className='bg-primary text-white px-8 py-2 md:mt-6 rounded hover:bg-primary/90 transition-all cursor-pointer font-medium'
        >
            Đặt vé ngay
        </button>
      </div>
    </div>
  )
}

export default DateSelect