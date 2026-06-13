import axios from "axios";
import crypto from "crypto";

const DEFAULT_CREATE_ORDER_ENDPOINT = "https://sb-openapi.zalopay.vn/v2/create";
const DEFAULT_QUERY_ORDER_ENDPOINT = "https://sb-openapi.zalopay.vn/v2/query";
const DEFAULT_CLIENT_URL = "https://quickshow-eight-rust.vercel.app";
const DEFAULT_SERVER_URL = "https://quickshow-qy3z.onrender.com";
const DEFAULT_ZALOPAY_EXPIRE_DURATION_SECONDS = 600;

// ZaloPay yêu cầu app_trans_id bắt đầu bằng ngày yyMMdd theo giờ Việt Nam.
const getVietnamDatePrefix = () => {
    const vietnamNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
    return vietnamNow.toISOString().slice(2, 10).replace(/-/g, "");
};

// Tạo MAC HMAC-SHA256 theo định dạng ZaloPay yêu cầu.
const signHmacSha256 = (data, key) => (
    crypto
        .createHmac("sha256", key)
        .update(data)
        .digest("hex")
);

// So sánh chữ ký theo thời gian cố định để hạn chế timing attack.
const safeSignatureEquals = (left = "", right = "") => {
    const leftBuffer = Buffer.from(`${left}`);
    const rightBuffer = Buffer.from(`${right}`);

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

// Gom cấu hình ZaloPay từ biến môi trường và cung cấp giá trị mặc định cho sandbox.
const getZaloPayConfig = () => {
    const clientUrl = (process.env.CLIENT_URL || DEFAULT_CLIENT_URL).replace(/\/$/, "");
    const serverUrl = (process.env.SERVER_URL || DEFAULT_SERVER_URL).replace(/\/$/, "");
    const preferredMethod = `${process.env.ZALOPAY_PREFERRED_METHOD || "zalopay_wallet"}`.trim();

    return {
        appId: process.env.ZALOPAY_APP_ID,
        key1: process.env.ZALOPAY_KEY1,
        key2: process.env.ZALOPAY_KEY2,
        createOrderEndpoint: process.env.ZALOPAY_CREATE_ORDER_ENDPOINT || DEFAULT_CREATE_ORDER_ENDPOINT,
        queryOrderEndpoint: process.env.ZALOPAY_QUERY_ORDER_ENDPOINT || DEFAULT_QUERY_ORDER_ENDPOINT,
        callbackUrl: process.env.ZALOPAY_CALLBACK_URL || `${serverUrl}/api/zalopay/callback`,
        redirectUrl: process.env.ZALOPAY_REDIRECT_URL || `${clientUrl}/loading/my-bookings`,
        preferredMethod,
        bankCode: process.env.ZALOPAY_BANK_CODE ?? (preferredMethod === "zalopay_wallet" ? "zalopayapp" : ""),
        expireDurationSeconds: Number(process.env.ZALOPAY_EXPIRE_DURATION_SECONDS || DEFAULT_ZALOPAY_EXPIRE_DURATION_SECONDS)
    };
};

// Chặn gọi ZaloPay khi thiếu các khóa bắt buộc.
const assertZaloPayConfig = (config) => {
    const missing = ["appId", "key1", "key2"].filter((key) => !config[key]);

    if (missing.length) {
        throw new Error(`Missing ZaloPay configuration: ${missing.join(", ")}`);
    }
};

// Tạo đơn ZaloPay đã ký MAC và trả URL/token thanh toán cho booking.
export const createZaloPayPayment = async ({ booking, amount, appUser }) => {
    const config = getZaloPayConfig();
    assertZaloPayConfig(config);

    const normalizedAmount = Math.floor(Number(amount || 0));
    const appTransId = `${getVietnamDatePrefix()}_${booking.bookingCode}_${Date.now().toString().slice(-6)}`;
    const items = [{
        itemid: booking.bookingCode,
        itemname: `QuickShow booking ${booking.bookingCode}`,
        itemprice: normalizedAmount,
        itemquantity: 1
    }];
    const embedData = {
        redirecturl: config.redirectUrl,
        bookingId: booking._id.toString(),
        bookingCode: booking.bookingCode
    };

    if (config.preferredMethod) {
        embedData.preferred_payment_method = [config.preferredMethod];
    }

    const order = {
        app_id: config.appId,
        app_trans_id: appTransId,
        app_user: `${appUser || booking.user || "quickshow"}`.slice(0, 50),
        app_time: Date.now(),
        item: JSON.stringify(items),
        embed_data: JSON.stringify(embedData),
        amount: normalizedAmount,
        description: `QuickShow - Thanh toan booking ${booking.bookingCode}`,
        bank_code: config.bankCode,
        callback_url: config.callbackUrl,
        expire_duration_seconds: config.expireDurationSeconds
    };

    const macData = [
        order.app_id,
        order.app_trans_id,
        order.app_user,
        order.amount,
        order.app_time,
        order.embed_data,
        order.item
    ].join("|");

    // key1 dùng để ký request chủ động gửi từ QuickShow sang ZaloPay.
    order.mac = signHmacSha256(macData, config.key1);

    const { data } = await axios.post(config.createOrderEndpoint, null, {
        params: order,
        timeout: 15000
    });

    if (Number(data?.return_code) !== 1 || !data?.order_url) {
        throw new Error(data?.return_message || data?.sub_return_message || "ZaloPay did not return a payment URL.");
    }

    return {
        ...data,
        appTransId
    };
};

// Xác thực MAC callback bằng key2 trước khi tin dữ liệu giao dịch ZaloPay gửi về.
export const verifyZaloPayCallback = (payload = {}) => {
    const config = getZaloPayConfig();
    assertZaloPayConfig(config);

    const data = `${payload.data || ""}`;
    const expectedMac = signHmacSha256(data, config.key2);

    if (!safeSignatureEquals(`${payload.mac || ""}`, expectedMac)) {
        return { isValid: false, data: null };
    }

    return {
        isValid: true,
        data: JSON.parse(data)
    };
};

// Chủ động truy vấn trạng thái đơn ZaloPay khi callback chưa đến hoặc người dùng quay lại FE.
export const queryZaloPayOrder = async (appTransId) => {
    const config = getZaloPayConfig();
    assertZaloPayConfig(config);

    const params = {
        app_id: config.appId,
        app_trans_id: appTransId
    };
    const macData = `${params.app_id}|${params.app_trans_id}|${config.key1}`;
    params.mac = signHmacSha256(macData, config.key1);

    const { data } = await axios.post(config.queryOrderEndpoint, null, {
        params,
        timeout: 15000
    });

    return data;
};
