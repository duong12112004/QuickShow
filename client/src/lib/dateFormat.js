// Định dạng ngày giờ ngắn gọn chuẩn Việt Nam (locale vi-VN)
export const dateFormat = (date) => {
    return new Date(date).toLocaleString('vi-VN', {
        weekday: 'short',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Định dạng thời gian chi tiết có kèm thứ trong tuần
export const formatTimeVN = (dateString) => {
    const date = new Date(dateString);

    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    const dayName = days[date.getDay()];
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();

    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    return `${dayName}, ${d}/${m}/${y} lúc ${h}:${min}`;
};

// Lấy thời gian thực tại trình duyệt để giới hạn dữ liệu đầu vào (min/max) cho thẻ input datetime-local
export const getCurrentDateTimeLocal = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Chuẩn hóa chuỗi thời gian bất kỳ về định dạng tương thích với thẻ <input type="datetime-local">
export const formatToDateTimeLocal = (dateString) => {
    const d = new Date(dateString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};