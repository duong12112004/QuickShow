// import { CalendarRangeIcon, LayoutDashboardIcon, ListCollapseIcon, ListIcon } from "lucide-react";
// import React from "react";
// import { NavLink } from "react-router-dom";
// import { assets } from "../../assets/assets";

// const AdminSidebar = () => {
//   const user = {
//     firstName: "Quan tri",
//     lastName: "vien",
//     imageUrl: assets.profile
//   };

//   const adminNavlinks = [
//     { name: "Dashboard", path: "/admin", icon: LayoutDashboardIcon },
//     { name: "Quản lý phòng chiếu", path: "/admin/rooms", icon: ListIcon },
//     { name: "Quản lý suất chiếu", path: "/admin/showtimes", icon: CalendarRangeIcon },
//     { name: "Danh sách đặt vé", path: "/admin/list-bookings", icon: ListCollapseIcon }
//   ];

//   return (
//     <div className="h-[calc(100vh-64px)] w-full max-w-13 border-r border-white/10 bg-slate-950/95 pt-8 text-sm md:flex md:max-w-64 md:flex-col md:items-center">
//       <img className="mx-auto h-9 w-9 rounded-full md:h-14 md:w-14" src={user.imageUrl} alt="sidebar" />
//       <p className="mt-2 text-base text-slate-100 max-md:hidden">{user.firstName} {user.lastName}</p>

//       <div className="mt-4 w-full">
//         {adminNavlinks.map((link, index) => (
//           <NavLink
//             key={index}
//             to={link.path}
//             end
//             className={({ isActive }) =>
//               `relative flex w-full items-center gap-3 py-3 text-slate-400 transition max-md:justify-center md:pl-10 ${
//                 isActive ? "bg-rose-500/12 text-rose-300" : "hover:bg-white/5 hover:text-white"
//               } ${index === 0 ? "first:mt-2" : ""}`
//             }
//           >
//             {({ isActive }) => (
//               <>
//                 <link.icon className="h-5 w-5" />
//                 <p className="max-md:hidden">{link.name}</p>
//                 <span className={`absolute right-0 h-10 w-1.5 rounded-l-full ${isActive ? "bg-rose-400" : ""}`} />
//               </>
//             )}
//           </NavLink>
//         ))}
//       </div>
//     </div>
//   );
// };

// export default AdminSidebar;


import { CalendarRangeIcon, LayoutDashboardIcon, ListCollapseIcon, ListIcon } from "lucide-react";
import React from "react";
import { NavLink } from "react-router-dom";
import { assets } from "../../assets/assets";

// Component thanh menu bên trái dành cho khu vực Admin
const AdminSidebar = () => {

  // Thông tin user hiển thị tạm thời (có thể thay bằng dữ liệu thật từ Clerk sau này)
  const user = {
    firstName: 'Quản trị',
    lastName: 'viên',
    imageUrl: assets.profile
  }

  const adminNavlinks = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboardIcon },
    { name: "Quản lý phòng chiếu", path: "/admin/rooms", icon: ListIcon },
    { name: "Quản lý suất chiếu", path: "/admin/showtimes", icon: CalendarRangeIcon },
    { name: "Danh sách đặt vé", path: "/admin/list-bookings", icon: ListCollapseIcon }
  ];

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