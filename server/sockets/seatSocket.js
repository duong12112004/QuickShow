export const handleSeatSockets = (socket) => {
    // Nhóm các Client vào một phòng (room) riêng biệt dựa trên ID của suất chiếu
    socket.on('join_show', (showId) => {
        socket.join(showId);
        console.log(`[Socket] Client ${socket.id} đã tham gia phòng suất chiếu: ${showId}`);
    });

    // Xử lý luồng dữ liệu Real-time khi người dùng đang thao tác chọn/bỏ chọn ghế
    socket.on('seat_selecting', ({ showId, seatId, action }) => {
        // Phát Broadcast (gửi đến tất cả mọi người trừ người gửi) để hiển thị ghế đang có người thao tác
        socket.to(showId).emit('update_live_seats', { seatId, action });
    });

    // Xử lý luồng dữ liệu khi người dùng bắt đầu chuyển sang bước thanh toán (Checkout)
    socket.on('seat_held_checkout', ({ showId, selectedSeats }) => {
        // Phát tín hiệu tạm thời khóa các ghế này trên giao diện của tất cả người dùng khác
        socket.to(showId).emit('lock_seats_temporarily', selectedSeats);
    });
};