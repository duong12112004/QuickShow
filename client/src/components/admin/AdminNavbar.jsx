import React from 'react'
import { Link } from 'react-router-dom'
import { assets } from '../../assets/assets'

// Component thanh điều hướng phía trên cùng dành cho khu vực Admin
const AdminNavbar = () => {
  return (
    <div className='flex items-center justify-between px-6 md:px-10 h-16 border-b border-gray-300/30'>
      <Link to="/">
        <img src={assets.logo} alt="logo" className='w-36 h-auto' />
      </Link>
    </div>
  )
}

export default AdminNavbar