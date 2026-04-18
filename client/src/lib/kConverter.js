// Chuyển đổi rút gọn các con số lớn (VD: 1500 -> 1.5k) để tối ưu không gian UI
export const kConverter = (num) => {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + "k";
    } else {
        return num;
    }
};