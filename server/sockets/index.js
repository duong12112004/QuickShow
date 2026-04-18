import { Server } from 'socket.io';
import { handleSeatSockets } from './seatSocket.js';

export const initializeSocket = (httpServer, app) => {
    // Cấu hình và khởi tạo máy chủ Socket.io để hỗ trợ giao tiếp Real-time
    const io = new Server(httpServer, {
        cors: {
            origin: "*", 
            methods: ["GET", "POST"]
        }
    });

    // Lưu trữ đối tượng io vào app context và global object để tái sử dụng trong Webhook và các Background Jobs (Inngest)
    app.set('io', io);
    global.io = io;

    // Quản lý các kết nối từ Client
    io.on('connection', (socket) => {
        console.log(`[Socket] Client đã kết nối: ${socket.id}`);

        // Phân luồng xử lý các sự kiện Real-time cho nghiệp vụ đặt/giữ ghế
        handleSeatSockets(socket);
        
        socket.on('disconnect', () => {
            console.log(`[Socket] Client đã ngắt kết nối: ${socket.id}`);
        });
    });

    return io;
};