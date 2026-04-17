
import { Server } from 'socket.io';
import { handleSeatSockets } from './seatSocket.js';

export const initializeSocket = (httpServer, app) => {
    // Khởi tạo Socket.io
    const io = new Server(httpServer, {
        cors: {
            origin: "*", 
            methods: ["GET", "POST"]
        }
    });

    // Gắn io vào app và global để Webhook và Inngest có thể gọi
    app.set('io', io);
    global.io = io;

    // Lắng nghe sự kiện kết nối
    io.on('connection', (socket) => {
        // Chuyển giao các sự kiện liên quan đến Ghế ngồi cho handleSeatSockets xử lý
        handleSeatSockets(socket);
        
        // (TƯƠNG LAI) Nếu có thêm tính năng chat, bạn có thể gọi: handleChatSockets(socket);
    });

    return io;
};