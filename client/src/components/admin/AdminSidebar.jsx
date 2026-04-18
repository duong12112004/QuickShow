import { LayoutDashboardIcon, ListCollapseIcon, ListIcon, PlusSquareIcon } from 'lucide-react'
import React from 'react'
import { NavLink } from 'react-router-dom'
import { assets } from '../../assets/assets'

// Component thanh menu bên trái dành cho khu vực Admin
const AdminSidebar = () => {

  // Thông tin user hiển thị tạm thời (có thể thay bằng dữ liệu thật từ Clerk sau này)
  const user = {
    firstName: 'Quản trị',
    lastName: 'viên',
    imageUrl: assets.profile
  }

  // Danh sách các menu điều hướng đã được Việt hóa
  const adminNavlinks = [
    { name: 'DashBoard', path: '/admin', icon: LayoutDashboardIcon },
    { name: 'Thêm suất chiếu', path: '/admin/add-shows', icon: PlusSquareIcon },
    { name: 'Danh sách suất chiếu', path: '/admin/list-shows', icon: ListIcon },
    { name: 'Danh sách đặt vé', path: '/admin/list-bookings', icon: ListCollapseIcon },
  ]

  return (
    <div className='h-[calc(100vh-64px)] md:flex flex-col items-center pt-8 max-w-13 md:max-w-60 w-full border-r border-gray-300/20 text-sm'>
      <img className='h-9 md:h-14 w-9 md:w-14 rounded-full mx-auto' src={user.imageUrl} alt="sidebar" />
      <p className='mt-2 text-base max-md:hidden'>{user.firstName} {user.lastName}</p>
      
      <div className='w-full'>
        {adminNavlinks.map((link, index) => (
          <NavLink 
            key={index} 
            to={link.path} 
            end 
            className={({ isActive }) => `relative flex items-center max-md:justify-center gap-2 w-full py-2.5 md:pl-10 first:mt-6 text-gray-400 ${isActive && 'bg-primary/15 text-primary group'}`}
          >
            {({ isActive }) => (
              <>
                <link.icon className='w-5 h-5'/>
                <p className='max-md:hidden'>{link.name}</p>
                {/* Thanh dọc hiển thị trạng thái đang chọn (Active) */}
                <span className={`w-1.5 h-10 rounded-l right-0 absolute ${isActive && 'bg-primary'}`}/>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

export default AdminSidebar