import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import connectDB from './configs/db.js';
import { clerkMiddleware } from '@clerk/express'
import { serve } from 'inngest/express'
import { inngest ,functions} from './inngest/index.js'
import showRouter from './routes/showRoutes.js'
import bookingRouter from './routes/bookingRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import userRouter from './routes/userRoutes.js';
import { stripeWebhooks } from './controllers/stripeWebhooks.js';

// --- 1. IMPORT THƯ VIỆN HTTP VÀ SOCKET.IO ---
import { createServer } from 'http'; 
import { Server } from 'socket.io';

const app = express();
const port = 3000;

// --- 2. TẠO HTTP SERVER VÀ KHỞI TẠO SOCKET ---
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Trong lúc dev, cho phép mọi Frontend gọi tới
        methods: ["GET", "POST"]
    }
});

// THÊM DÒNG NÀY: Gắn io vào app để các file khác (như Webhook) có thể mượn xài
app.set('io', io);
global.io = io;

// --- 3. LẮNG NGHE SỰ KIỆN REAL-TIME TỪ CLIENT ---
io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    // Khi người dùng bấm vào 1 khung giờ chiếu -> Cho họ vào "phòng chat" của suất chiếu đó
    socket.on('join_show', (showId) => {
        socket.join(showId);
        console.log(`User ${socket.id} joined show: ${showId}`);
    });

    // Khi người dùng Click chọn (hoặc bỏ chọn) 1 cái ghế
    socket.on('seat_selecting', ({ showId, seatId, action }) => {
        // Gửi sự kiện này cho tất cả những người khác trong CÙNG 1 SUẤT CHIẾU (trừ người gửi)
        socket.to(showId).emit('update_live_seats', { seatId, action });
    });

    // Khi người dùng bấm "Proceed to Checkout"
    socket.on('seat_held_checkout', ({ showId, selectedSeats }) => {
        // Khóa ghế ngay lập tức trên màn hình của những người khác
        socket.to(showId).emit('lock_seats_temporarily', selectedSeats);
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] User disconnected: ${socket.id}`);
    });
});

await connectDB();

// Stripe Webhooks Route
app.use('/api/stripe', express.raw({ type: 'application/json' }), stripeWebhooks)

// Middleware
app.use(express.json())
app.use(cors())
app.use(clerkMiddleware())

// API Routes
app.get('/',(req,res)=> res.send('Server is Live!'))
app.use('/api/inngest',serve({client:inngest,functions}))
app.use('/api/show',showRouter)
app.use('/api/booking',bookingRouter)
app.use('/api/admin',adminRouter)
app.use('/api/user',userRouter)

// --- 4. THAY ĐỔI LỆNH LISTEN ---
// Chú ý: Phải dùng httpServer.listen thay vì app.listen
httpServer.listen(port, () => console.log(`Server & Socket.io listening at http://localhost:${port}`));