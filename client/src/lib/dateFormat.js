export const dateFormat = (date) => {
    return new Date(date).toLocaleString('en-US', {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
    })
}
// Hàm format thời gian sang Tiếng Việt
export const formatTimeVN = (dateString) => {
    const date = new Date(dateString);

    // Mảng tên các thứ trong tuần
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    const dayName = days[date.getDay()]; // Lấy thứ
    const d = String(date.getDate()).padStart(2, '0'); // Lấy ngày (thêm số 0 đằng trước nếu < 10)
    const m = String(date.getMonth() + 1).padStart(2, '0'); // Lấy tháng (tháng trong JS bắt đầu từ 0 nên phải +1)
    const y = date.getFullYear(); // Lấy năm

    const h = String(date.getHours()).padStart(2, '0'); // Lấy giờ
    const min = String(date.getMinutes()).padStart(2, '0'); // Lấy phút

    // Ghép chuỗi theo đúng thứ tự bạn muốn
    return `${dayName}, ${d}/${m}/${y} lúc ${h}:${min}`;
};

// 1. Hàm lấy thời gian HIỆN TẠI (Dùng để chặn ngày quá khứ ở thẻ input)
export const getCurrentDateTimeLocal = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

// 2. Hàm chuyển đổi một thời gian BẤT KỲ sang chuẩn của thẻ <input type="datetime-local">
export const formatToDateTimeLocal = (dateString) => {
    const d = new Date(dateString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };