import { io } from 'socket.io-client';

const backendUrl = import.meta.env.VITE_BASE_URL;

// Khởi tạo một phiên bản Socket.io client duy nhất (Singleton Pattern)
// Giúp toàn bộ các component trong ứng dụng sử dụng chung một kết nối (connection) đến Server
export const socket = io(backendUrl, {
    reconnection: true, // Tự động thử kết nối lại khi thiết bị mất mạng
});