export const handleSeatSockets = (socket) => {
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
};