import { Inngest } from "inngest";
import QRCode from "qrcode";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../configs/nodeMailer.js";
import {
    BOOKING_STATUS,
    PAYMENT_HOLD_MINUTES,
    PAYMENT_STATUS,
    STATUS_ACTOR,
    createCheckInQrToken,
    releaseSeats,
    setBookingStatuses
} from "../services/bookingService.js";
import { getShowtimeLifecycle } from "../services/showtimeService.js";
import { reverseWalletDebit } from "../services/walletService.js";

// Client Inngest dùng để đăng ký và gửi các event chạy nền của hệ thống đặt vé.
export const inngest = new Inngest({ id: "movie-ticket-booking" });

// Các helper format dưới đây chỉ phục vụ nội dung email, không thay đổi dữ liệu booking trong database.
const formatEmailDateTime = (value) => (
    value
        ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
        : "Chưa có dữ liệu"
);

const formatEmailMoney = (value, currency = "VND") => `${Number(value || 0).toLocaleString("vi-VN")} ${currency}`;

// Hiển thị danh sách ghế an toàn cho cả booking một ghế, nhiều ghế hoặc dữ liệu cũ thiếu bookedSeats.
const formatBookedSeats = (booking) => (
    Array.isArray(booking?.bookedSeats) && booking.bookedSeats.length
        ? booking.bookedSeats.join(", ")
        : "Chưa có dữ liệu"
);

// Ưu tiên tên phim tiếng Việt từ show.movie, fallback về snapshot movieTitle của booking.
const getBookingMovieTitle = (booking) => (
    booking?.show?.movie?.titleVi
    || booking?.movieTitle
    || booking?.show?.movie?.title
    || "Phim không xác định"
);

// Render block combo bắp nước trong email; trả chuỗi rỗng nếu booking không mua kèm combo.
const renderConcessionItems = (booking) => {
    const items = booking.concessionItems || [];

    if (!items.length) {
        return "";
    }

    const rows = items.map((item) => `
        <tr>
            <td style="padding: 8px 0;">${item.name} x${item.quantity}</td>
            <td style="padding: 8px 0; text-align: right;">${formatEmailMoney(item.totalPrice, booking.currency)}</td>
        </tr>
    `).join("");

    return `
        <div style="background-color: #fff7f8; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffd7df;">
            <p style="margin: 0 0 10px 0;"><strong>Combo bắp nước đã mua</strong></p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                ${rows}
                <tr>
                    <td style="padding: 10px 0 0 0; border-top: 1px solid #ffd7df;"><strong>Tổng đồ ăn</strong></td>
                    <td style="padding: 10px 0 0 0; border-top: 1px solid #ffd7df; text-align: right;"><strong>${formatEmailMoney(booking.concessionAmount, booking.currency)}</strong></td>
                </tr>
            </table>
        </div>
    `;
};

// Sinh thông báo hoàn tiền theo trạng thái hiện tại của booking.
const getBookingRefundMessage = (booking) => {
    if (booking.paymentStatus === PAYMENT_STATUS.REFUND_FAILED) {
        return "Yêu cầu hoàn tiền chưa hoàn tất. QuickShow sẽ kiểm tra và xử lý lại trong thời gian sớm nhất.";
    }

    if (booking.paymentStatus === PAYMENT_STATUS.REFUND_PENDING) {
        return `Yêu cầu hoàn tiền đang được xử lý. Số tiền dự kiến hoàn: ${formatEmailMoney(booking.refundAmount, booking.currency)}.`;
    }

    if (booking.paymentStatus === PAYMENT_STATUS.REFUNDED || booking.refundAmount > 0) {
        const refundRate = booking.refundRate ? ` (${Math.round(booking.refundRate * 100)}%)` : "";
        const feeText = booking.refundFeeAmount > 0
            ? ` Phí hủy: ${formatEmailMoney(booking.refundFeeAmount, booking.currency)}.`
            : "";

        return `Đã hoàn ${formatEmailMoney(booking.refundAmount, booking.currency)}${refundRate} vào ví QuickShow.${feeText}`;
    }

    return "Booking này chưa phát sinh hoàn tiền.";
};

// Block tóm tắt booking dùng lại cho email hủy booking và hủy suất chiếu.
const renderBookingSummary = (booking) => `
    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Mã booking:</strong> ${booking.bookingCode}</p>
        <p style="margin: 0 0 10px 0;"><strong>Phim:</strong> ${getBookingMovieTitle(booking)}</p>
        <p style="margin: 0 0 10px 0;"><strong>Phòng chiếu:</strong> ${booking.roomName}</p>
        <p style="margin: 0 0 10px 0;"><strong>Ngày giờ chiếu:</strong> ${formatEmailDateTime(booking.showDateTime)}</p>
        <p style="margin: 0;"><strong>Ghế:</strong> ${formatBookedSeats(booking)}</p>
    </div>
`;

// Đồng bộ user mới từ Clerk webhook vào collection User nội bộ.
const syncUserCreation = inngest.createFunction(
    {
        id: "sync-user-from-clerk",
        triggers: { event: "clerk/user.created" }
    },
    async ({ event }) => {
        const { id, first_name, last_name, email_addresses, image_url } = event.data;
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: `${first_name} ${last_name}`.trim(),
            image: image_url
        };
        await User.create(userData);
    }
);

// Xóa user nội bộ khi Clerk báo tài khoản bị xóa.
const syncUserDeletion = inngest.createFunction(
    {
        id: "delete-user-with-clerk",
        triggers: { event: "clerk/user.deleted" }
    },
    async ({ event }) => {
        const { id } = event.data;
        await User.findByIdAndDelete(id);
    }
);

// Cập nhật thông tin user nội bộ khi hồ sơ Clerk thay đổi.
const syncUserUpdation = inngest.createFunction(
    {
        id: "update-user-from-clerk",
        triggers: { event: "clerk/user.updated" }
    },
    async ({ event }) => {
        const { id, first_name, last_name, email_addresses, image_url } = event.data;
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: `${first_name} ${last_name}`.trim(),
            image: image_url
        };
        await User.findByIdAndUpdate(id, userData);
    }
);

// Sau thời gian giữ ghế, tự hết hạn booking chưa thanh toán, hoàn ví đã trừ và nhả ghế.
const expireUnpaidBookings = inngest.createFunction(
    {
        id: "expire-unpaid-booking",
        triggers: { event: "app/checkpayment" }
    },
    async ({ event, step }) => {
        const holdMinutes = Number(event.data.holdMinutes || PAYMENT_HOLD_MINUTES);
        const expiresAt = new Date(event.data.expiresAt || Date.now() + holdMinutes * 60 * 1000);
        // Inngest sleep giữ job ở trạng thái chờ thay vì tự setTimeout trong server.
        await step.sleepUntil("wait-until-booking-expired", expiresAt);

        await step.run("expire-booking-and-release-seats", async () => {
            const booking = await Booking.findById(event.data.bookingId);

            if (!booking) {
                return;
            }

            // Nếu booking đã được thanh toán hoặc bị hủy bởi luồng khác thì không xử lý hết hạn nữa.
            if (booking.paymentStatus !== PAYMENT_STATUS.UNPAID || booking.bookingStatus !== BOOKING_STATUS.PENDING_PAYMENT) {
                return;
            }

            setBookingStatuses(booking, {
                bookingStatus: BOOKING_STATUS.PAYMENT_EXPIRED,
                paymentStatus: PAYMENT_STATUS.EXPIRED,
                actor: STATUS_ACTOR.SYSTEM,
                isPaid: false,
                note: `Quá hạn ${holdMinutes} phút thanh toán, hệ thống tự động nhả ghế.`
            });
            booking.paymentLink = "";
            await booking.save();

            if (booking.walletAmountUsed > 0) {
                // Booking có thể dùng một phần ví trước khi qua cổng thanh toán, nên phải hoàn lại ví khi hết hạn.
                await reverseWalletDebit({
                    userId: booking.user,
                    bookingId: booking._id,
                    amount: booking.walletAmountUsed,
                    note: `Hoàn lại ví vì booking ${booking.bookingCode} hết hạn thanh toán.`,
                    metadata: { bookingCode: booking.bookingCode }
                });
                booking.walletAmountUsed = 0;
                await booking.save();
            }

            await releaseSeats(booking.show, booking.bookedSeats, {
                fromHeld: true,
                fromOccupied: false
            });

            if (global.io) {
                // Báo realtime để các client đang xem sơ đồ ghế thấy ghế được mở lại.
                global.io.to(booking.show.toString()).emit("seats_released", booking.bookedSeats);
            }
        });
    }
);

// Gửi email xác nhận sau khi booking được thanh toán thành công.
const sendBookingConfirmationEmail = inngest.createFunction(
    {
        id: "send-booking-confirmation-email",
        idempotency: "event.data.bookingId",
        triggers: { event: "app/show.booked" }
    },
    async ({ event, step }) => {
        await step.run("fetch-booking-and-send-email", async () => {
            // Claim bằng confirmationEmailSentAt để tránh gửi trùng khi webhook và user-return cùng phát event.
            const booking = await Booking.findOneAndUpdate(
                {
                    _id: event.data.bookingId,
                    confirmationEmailSentAt: null
                },
                {
                    $set: { confirmationEmailSentAt: new Date() }
                },
                { new: true }
            )
                .populate("user")
                .populate({ path: "show", populate: { path: "movie" } });

            if (!booking || !booking.user) {
                return;
            }

            try {
                // QR check-in được đính kèm bằng CID để email hiển thị trực tiếp trong nội dung.
                const qrToken = createCheckInQrToken(booking);
                const qrImage = await QRCode.toBuffer(qrToken, {
                    type: "png",
                    width: 260,
                    margin: 1,
                    errorCorrectionLevel: "M"
                });

                await sendEmail({
                    to: booking.user.email,
                    subject: `Xác nhận đặt vé thành công: ${getBookingMovieTitle(booking)}`,
                    body: `
                        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
                            <h2>Xin chào ${booking.user.name},</h2>
                            <p>Booking <strong>${booking.bookingCode}</strong> cho phim <strong style="color: #F84565;">${getBookingMovieTitle(booking)}</strong> đã được thanh toán thành công.</p>
                            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0 0 10px 0;"><strong>Phòng chiếu:</strong> ${booking.roomName}</p>
                                <p style="margin: 0 0 10px 0;"><strong>Ngày giờ chiếu:</strong> ${new Date(booking.showDateTime).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
                                <p style="margin: 0;"><strong>Ghế:</strong> ${formatBookedSeats(booking)}</p>
                            </div>
                            ${renderConcessionItems(booking)}
                            <p><strong>Tổng thanh toán:</strong> ${formatEmailMoney(booking.amount, booking.currency)}</p>
                            <div style="margin: 20px 0; text-align: center;">
                                <p style="margin: 0 0 12px 0; font-weight: 700;">QR check-in</p>
                                <img src="cid:booking-check-in-qr" alt="QR check-in ${booking.bookingCode}" width="220" height="220" style="display: inline-block; border: 1px solid #eee; border-radius: 12px; padding: 10px; background: #fff;" />
                                <p style="margin: 12px 0 0 0; color: #666; font-size: 13px;">Đưa QR này cho nhân viên rạp quét khi đến check-in.</p>
                            </div>
                            <p>Vui lòng giữ lại mã booking <strong>${booking.bookingCode}</strong> hoặc QR code để check-in tại rạp.</p>
                            <p>Trân trọng,<br/><strong>Đội ngũ QuickShow</strong></p>
                        </div>
                    `,
                    attachments: [{
                        filename: `quickshow-${booking.bookingCode}-qr.png`,
                        content: qrImage,
                        cid: "booking-check-in-qr"
                    }]
                });
            } catch (error) {
                // Mở khóa lại để Inngest retry nếu tạo QR hoặc gửi email thất bại.
                await Booking.updateOne(
                    { _id: booking._id },
                    { $set: { confirmationEmailSentAt: null } }
                );
                throw error;
            }
        });
    }
);

// Gửi email khi một booking cụ thể bị người dùng hoặc admin hủy.
const sendBookingCancellationEmail = inngest.createFunction(
    {
        id: "send-booking-cancellation-email",
        triggers: { event: "app/booking.cancelled" }
    },
    async ({ event, step }) => {
        await step.run("fetch-booking-and-send-cancellation-email", async () => {
            const booking = await Booking.findById(event.data.bookingId)
                .populate("user")
                .populate({ path: "show", populate: { path: "movie" } });

            if (!booking || !booking.user?.email) {
                return;
            }

            const cancelledBy = event.data.cancelledBy || booking.cancelledBy || "";
            const actorLabel = cancelledBy === "USER"
                ? "theo yêu cầu của bạn"
                : "bởi quản trị viên QuickShow";
            const reason = event.data.reason || booking.cancelReason || "Không có lý do cụ thể.";

            // Email dùng trạng thái refund hiện tại của booking sau khi service hủy/hoàn tiền đã xử lý.
            await sendEmail({
                to: booking.user.email,
                subject: `Thông báo hủy booking: ${booking.bookingCode}`,
                body: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
                        <h2>Xin chào ${booking.user.name},</h2>
                        <p>Booking <strong>${booking.bookingCode}</strong> đã được hủy ${actorLabel}.</p>
                        ${renderBookingSummary(booking)}
                        ${renderConcessionItems(booking)}
                        <div style="background-color: #fff6e5; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #f1c56c;">
                            <p style="margin: 0 0 10px 0;"><strong>Lý do hủy:</strong> ${reason}</p>
                            <p style="margin: 0;"><strong>Hoàn tiền:</strong> ${getBookingRefundMessage(booking)}</p>
                        </div>
                        <p>Bạn có thể kiểm tra ví QuickShow và lịch sử booking trong tài khoản của mình.</p>
                        <p>Trân trọng,<br/><strong>Đội ngũ QuickShow</strong></p>
                    </div>
                `
            });
        });
    }
);

// Gửi email cho từng booking bị ảnh hưởng khi admin hủy cả suất chiếu.
const sendShowtimeCancellationEmail = inngest.createFunction(
    {
        id: "send-showtime-cancellation-email",
        triggers: { event: "app/show.cancelled.booking" }
    },
    async ({ event, step }) => {
        await step.run("fetch-booking-and-send-showtime-cancellation-email", async () => {
            const booking = await Booking.findById(event.data.bookingId)
                .populate("user")
                .populate({ path: "show", populate: { path: "movie" } });

            if (!booking || !booking.user?.email) {
                return;
            }

            const reason = event.data.cancellationReason || booking.cancelReason || "Không có lý do cụ thể.";

            await sendEmail({
                to: booking.user.email,
                subject: `Suất chiếu đã bị hủy: ${getBookingMovieTitle(booking)}`,
                body: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
                        <h2>Xin chào ${booking.user.name},</h2>
                        <p>QuickShow rất tiếc phải thông báo suất chiếu của phim <strong style="color: #F84565;">${getBookingMovieTitle(booking)}</strong> đã bị hủy.</p>
                        ${renderBookingSummary(booking)}
                        ${renderConcessionItems(booking)}
                        <div style="background-color: #fff6e5; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #f1c56c;">
                            <p style="margin: 0 0 10px 0;"><strong>Lý do hủy suất chiếu:</strong> ${reason}</p>
                            <p style="margin: 0;"><strong>Trạng thái booking/hoàn tiền:</strong> ${getBookingRefundMessage(booking)}</p>
                        </div>
                        <p>Nếu booking đã thanh toán, tiền hoàn sẽ được cộng vào ví QuickShow theo chính sách của hệ thống.</p>
                        <p>Trân trọng,<br/><strong>Đội ngũ QuickShow</strong></p>
                    </div>
                `
            });
        });
    }
);

// Mỗi giờ quét các booking sắp chiếu trong khoảng mục tiêu và gửi email nhắc lịch.
const sendShowReminders = inngest.createFunction(
    {
        id: "send-show-reminders",
        triggers: { cron: "0 * * * *" }
    },
    async ({ step }) => {
        const now = new Date();
        // Window 7-8 giờ tới: cron chạy hằng giờ nên mỗi booking chỉ rơi vào một cửa sổ nhắc lịch.
        const windowEnd = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const windowStart = new Date(windowEnd.getTime() - 60 * 60 * 1000);

        const bookings = await step.run("collect-bookings-for-reminders", async () => (
            Booking.find({
                bookingStatus: BOOKING_STATUS.CONFIRMED,
                paymentStatus: PAYMENT_STATUS.PAID,
                showDateTime: { $gte: windowStart, $lte: windowEnd }
            })
                .populate("user")
                .populate({ path: "show", populate: { path: "movie" } })
        ));

        if (!bookings.length) {
            return { sent: 0, failed: 0 };
        }

        // Promise.allSettled giúp một email lỗi không làm hỏng toàn bộ batch nhắc lịch.
        const results = await step.run("send-reminder-mails", async () => Promise.allSettled(
            bookings
                .filter((booking) => booking.user?.email)
                .map((booking) => sendEmail({
                    to: booking.user.email,
                    subject: `Nhắc lịch xem phim: ${getBookingMovieTitle(booking)}`,
                    body: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                            <h2>Xin chào ${booking.user.name},</h2>
                            <p>Đây là email nhắc lịch cho booking <strong>${booking.bookingCode}</strong>.</p>
                            <p>Phim <strong style="color: #F84565;">${getBookingMovieTitle(booking)}</strong> sẽ bắt đầu lúc <strong>${new Date(booking.showDateTime).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</strong>.</p>
                            <p>Ghế của bạn: <strong>${formatBookedSeats(booking)}</strong>.</p>
                            <p>Vui lòng đến rạp sớm để check-in thuận tiện.</p>
                            <p>Trân trọng,<br/><strong>Đội ngũ QuickShow</strong></p>
                        </div>
                    `
                }))
        ));

        const sent = results.filter((item) => item.status === "fulfilled").length;
        const failed = results.length - sent;

        return { sent, failed };
    }
);

// Mỗi giờ đánh dấu NO_SHOW cho booking đã thanh toán nhưng suất chiếu đã kết thúc và chưa check-in.
const markNoShowBookings = inngest.createFunction(
    {
        id: "mark-no-show-bookings",
        triggers: { cron: "0 * * * *" }
    },
    async ({ step }) => {
        await step.run("mark-ended-confirmed-bookings-as-no-show", async () => {
            const bookings = await Booking.find({
                bookingStatus: BOOKING_STATUS.CONFIRMED,
                paymentStatus: PAYMENT_STATUS.PAID
            }).populate("show");

            for (const booking of bookings) {
                if (!booking.show) {
                    continue;
                }

                if (getShowtimeLifecycle(booking.show) !== "ENDED") {
                    continue;
                }

                setBookingStatuses(booking, {
                    bookingStatus: BOOKING_STATUS.NO_SHOW,
                    paymentStatus: PAYMENT_STATUS.PAID,
                    actor: STATUS_ACTOR.SYSTEM,
                    isPaid: true,
                    note: "Suất chiếu đã kết thúc nhưng booking chưa check-in."
                });

                await booking.save();
            }
        });
    }
);

// Gửi email marketing khi admin thêm lịch chiếu mới cho một phim.
const sendNewShowNotifications = inngest.createFunction(
    {
        id: "send-new-show-notifications",
        triggers: { event: "app/show.added" }
    },
    async ({ event, step }) => {
        const users = await step.run("fetch-all-users", async () => (
            User.find({}).select("name email").lean()
        ));

        if (!users?.length) {
            return { sent: 0 };
        }

        const results = await step.run("send-show-notification-mails", async () => {
            const sendResults = [];

            for (const user of users) {
                try {
                    await sendEmail({
                        to: user.email,
                        subject: `Phim mới đã có lịch chiếu: ${event.data.movieTitle}`,
                        body: `
                            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                                <h2>Xin chào ${user.name},</h2>
                                <p>QuickShow vừa cập nhật lịch chiếu mới cho phim <strong style="color: #F84565;">${event.data.movieTitle}</strong>.</p>
                                <p>Hãy truy cập hệ thống để chọn suất chiếu và đặt ghế sớm.</p>
                                <p>Trân trọng,<br/><strong>Đội ngũ QuickShow</strong></p>
                            </div>
                        `
                    });
                    sendResults.push({ email: user.email, status: "sent" });
                } catch (error) {
                    console.error(`[Inngest] Lỗi gửi email thông báo phim mới cho ${user.email}:`, error.message);
                    sendResults.push({ email: user.email, status: "failed", error: error.message });
                }
            }

            return sendResults;
        });

        const sent = results.filter((item) => item.status === "sent").length;
        const failed = results.length - sent;

        if (sent === 0 && failed > 0) {
            throw new Error(`Failed to send new show notifications to all ${failed} users.`);
        }

        return { sent, failed };
    }
);

// Danh sách function được mount ở /api/inngest trong server.js.
export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    expireUnpaidBookings,
    sendBookingConfirmationEmail,
    sendBookingCancellationEmail,
    sendShowtimeCancellationEmail,
    sendShowReminders,
    markNoShowBookings,
    sendNewShowNotifications
];
