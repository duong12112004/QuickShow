// Trích xuất và định dạng giờ:phút theo hệ 24h từ chuỗi thời gian ISO
const isoTimeFormat = (dateTime) => {
    const date = new Date(dateTime);
    const localTime = date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
    });
    return localTime;
};

export default isoTimeFormat;