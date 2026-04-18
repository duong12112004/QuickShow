// Chuyển đổi tổng số phút thành định dạng thời lượng trực quan
const timeFormat = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const minutesRemainder = minutes % 60;
    
    // Nếu số phút chẵn (ví dụ 120 phút = 2 giờ) thì ẩn đi phần "0 phút"
    if (minutesRemainder === 0) {
        return `${hours} giờ`;
    }
    
    return `${hours} giờ ${minutesRemainder} phút`;
};

export default timeFormat;