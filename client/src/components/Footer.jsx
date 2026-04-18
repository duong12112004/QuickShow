import React from 'react'
import { assets } from '../assets/assets'

// Component chân trang (Footer)
const Footer = () => {
  return (
    <footer className="px-6 md:px-16 mt-40 lg:px-36 w-full text-gray-300 bg-black/20 pt-10 border-t border-gray-800">
            <div className="flex flex-col md:flex-row justify-between w-full gap-10 border-b border-gray-800 pb-14">
                <div className="md:max-w-96">
                    <img alt="QuickShow Logo" className="h-11" src={assets.logo} />
                    <p className="mt-6 text-sm leading-relaxed text-gray-400">
                        QuickShow là hệ thống đặt vé xem phim trực tuyến hàng đầu, mang đến cho bạn trải nghiệm giải trí tuyệt vời với hàng loạt bom tấn điện ảnh, chất lượng dịch vụ đỉnh cao và thao tác đặt vé siêu tốc.
                    </p>
                    <div className="flex items-center gap-3 mt-6">
                        <img src={assets.googlePlay} alt="Tải trên Google Play" className="h-9 w-auto cursor-pointer hover:opacity-80 transition" />
                        <img src={assets.appStore} alt="Tải trên App Store" className="h-9 w-auto cursor-pointer hover:opacity-80 transition" />
                    </div>
                </div>
                <div className="flex-1 flex items-start md:justify-end gap-20 md:gap-40">
                    <div>
                        <h2 className="font-semibold mb-5 text-white">Về chúng tôi</h2>
                        <ul className="text-sm space-y-3 text-gray-400">
                            <li><a href="#" className="hover:text-primary transition">Trang chủ</a></li>
                            <li><a href="#" className="hover:text-primary transition">Giới thiệu</a></li>
                            <li><a href="#" className="hover:text-primary transition">Hỗ trợ khách hàng</a></li>
                            <li><a href="#" className="hover:text-primary transition">Chính sách bảo mật</a></li>
                        </ul>
                    </div>
                    <div>
                        <h2 className="font-semibold mb-5 text-white">Liên hệ</h2>
                        <div className="text-sm space-y-3 text-gray-400">
                            <p>+84 234 567 890</p>
                            <p>support@quickshow.vn</p>
                        </div>
                    </div>
                </div>
            </div>
            <p className="pt-6 pb-6 text-center text-sm text-gray-500">
                Bản quyền {new Date().getFullYear()} © QuickShow. Phát triển bởi Phạm Việt Dương.
            </p>
        </footer>
  )
}

export default Footer