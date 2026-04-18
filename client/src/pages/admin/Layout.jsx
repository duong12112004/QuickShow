import React, { useEffect } from 'react'
import AdminNavbar from '../../components/admin/AdminNavbar'
import AdminSidebar from '../../components/admin/AdminSidebar'
import { Outlet } from 'react-router-dom'
import Loading from '../../components/Loading'
import { useAppContext } from '../../context/AppContext'

const Layout = () => {
  const { isAdmin, fetchIsAdmin } = useAppContext();

  // Kiểm tra quyền Admin mỗi khi truy cập vào layout quản trị
  useEffect(() => {
      fetchIsAdmin();
  }, []);

  // Chỉ render giao diện Admin nếu người dùng có quyền, ngược lại hiển thị màn hình Loading (hoặc redirect tùy logic bên App.jsx)
  return isAdmin ?  (
    <>
      <AdminNavbar/>
      <div className='flex'>
        <AdminSidebar/>
        <div className='flex-1 px-4 py-10 md:px-10 h-[calc(100vh-64px)] overflow-y-auto'>
          {/* Nơi render các component con (Dashboard, AddShow, ListShows...) */}
          <Outlet/>
        </div>
      </div>
    </>
  ) : <Loading/>
}

export default Layout