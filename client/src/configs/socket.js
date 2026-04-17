
import { io } from 'socket.io-client';

const backendUrl = import.meta.env.VITE_BASE_URL;

// Khởi tạo và xuất ra một kết nối Socket duy nhất
// Bất kỳ file nào import biến `socket` này đều đang dùng chung 1 đường truyền
export const socket = io(backendUrl, {
    // Tùy chọn cấu hình thêm (nếu cần)
    reconnection: true, // Tự động kết nối lại nếu mạng rớt
});