import React, { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

// Component hiển thị màn hình chờ tải dữ liệu hoặc xử lý thanh toán
const Loading = () => {

  const { nextUrl } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (nextUrl) {
      // Chuyển hướng sau 8 giây (Thường dùng để mô phỏng thời gian đợi Stripe xử lý)
      const timer = setTimeout(() => {
        navigate('/' + nextUrl)
      }, 5000)
      
      // Cleanup timer để tránh memory leak nếu component bị unmount sớm
      return () => clearTimeout(timer)
    }
  }, [nextUrl, navigate])

  return (
    <div className='flex justify-center items-center h-[80vh]'>
      <div className='animate-spin rounded-full h-14 w-14 border-2 border-t-primary'></div>
    </div>
  )
}

export default Loading