import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../configs/nodeMailer.js";
import {
    BOOKING_STATUS,
    PAYMENT_HOLD_MINUTES,
    PAYMENT_STATUS,
    STATUS_ACTOR,
    releaseSeats,
    setBookingStatuses
} from "../services/bookingService.js";
import { getShowtimeLifecycle } from "../services/showtimeService.js";

export const inngest = new Inngest({ id: "movie-ticket-booking" });

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

const expireUnpaidBookings = inngest.createFunction(
    {
        id: "expire-unpaid-booking",
        triggers: { event: "app/checkpayment" }
    },
    async ({ event, step }) => {
        const expiresAt = new Date(event.data.expiresAt || Date.now());
        await step.sleepUntil("wait-until-booking-expired", expiresAt);

        await step.run("expire-booking-and-release-seats", async () => {
            const booking = await Booking.findById(event.data.bookingId);

            if (!booking) {
                return;
            }

            if (booking.paymentStatus !== PAYMENT_STATUS.UNPAID || booking.bookingStatus !== BOOKING_STATUS.PENDING_PAYMENT) {
                return;
            }

            setBookingStatuses(booking, {
                bookingStatus: BOOKING_STATUS.PAYMENT_EXPIRED,
                paymentStatus: PAYMENT_STATUS.EXPIRED,
                actor: STATUS_ACTOR.SYSTEM,
                isPaid: false,
                note: `Quá hạn ${PAYMENT_HOLD_MINUTES} phút thanh toán, hệ thống tự động nhả ghế.`
            });
            booking.paymentLink = "";
            await booking.save();

            await releaseSeats(booking.show, booking.bookedSeats, {
                fromHeld: true,
                fromOccupied: false
            });

            if (global.io) {
                global.io.to(booking.show.toString()).emit("seats_released", booking.bookedSeats);
            }
        });
    }
);

const sendBookingConfirmationEmail = inngest.createFunction(
    {
        id: "send-booking-confirmation-email",
        triggers: { event: "app/show.booked" }
    },
    async ({ event, step }) => {
        await step.run("fetch-booking-and-send-email", async () => {
            const booking = await Booking.findOneAndUpdate(
                {
                    _id: event.data.bookingId,
                    confirmationEmailSentAt: null
                },
                {
                    $set: { confirmationEmailSentAt: new Date() }
                },
                { new: true }
            ).populate("user");

            if (!booking || !booking.user) {
                return;
            }

            await sendEmail({
                to: booking.user.email,
                subject: `Xác nhận đặt vé thành công: ${booking.movieTitle}`,
                body: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
                        <h2>Xin chào ${booking.user.name},</h2>
                        <p>Booking <strong>${booking.bookingCode}</strong> cho phim <strong style="color: #F84565;">${booking.movieTitle}</strong> đã được thanh toán thành công.</p>
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0 0 10px 0;"><strong>Phòng chiếu:</strong> ${booking.roomName}</p>
                            <p style="margin: 0 0 10px 0;"><strong>Ngày giờ chiếu:</strong> ${new Date(booking.showDateTime).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
                            <p style="margin: 0;"><strong>Ghế:</strong> ${booking.bookedSeats.join(", ")}</p>
                        </div>
                        <p>Vui lòng giữ lại mã booking để check-in tại rạp.</p>
                        <p>Trân trọng,<br/><strong>Đội ngũ QuickShow</strong></p>
                    </div>
                `
            });
        });
    }
);

const sendShowReminders = inngest.createFunction(
    {
        id: "send-show-reminders",
        triggers: { cron: "0 * * * *" }
    },
    async ({ step }) => {
        const now = new Date();
        const windowEnd = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const windowStart = new Date(windowEnd.getTime() - 60 * 60 * 1000);

        const bookings = await step.run("collect-bookings-for-reminders", async () => (
            Booking.find({
                bookingStatus: BOOKING_STATUS.CONFIRMED,
                paymentStatus: PAYMENT_STATUS.PAID,
                showDateTime: { $gte: windowStart, $lte: windowEnd }
            }).populate("user")
        ));

        if (!bookings.length) {
            return { sent: 0, failed: 0 };
        }

        const results = await step.run("send-reminder-mails", async () => Promise.allSettled(
            bookings
                .filter((booking) => booking.user?.email)
                .map((booking) => sendEmail({
                    to: booking.user.email,
                    subject: `Nhắc lịch xem phim: ${booking.movieTitle}`,
                    body: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                            <h2>Xin chào ${booking.user.name},</h2>
                            <p>Đây là email nhắc lịch cho booking <strong>${booking.bookingCode}</strong>.</p>
                            <p>Phim <strong style="color: #F84565;">${booking.movieTitle}</strong> sẽ bắt đầu lúc <strong>${new Date(booking.showDateTime).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</strong>.</p>
                            <p>Ghế của bạn: <strong>${booking.bookedSeats.join(", ")}</strong>.</p>
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

        await step.run("send-show-notification-mails", async () => {
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
                } catch (error) {
                    console.error(`[Inngest] Lỗi gửi email thông báo phim mới cho ${user.email}:`, error.message);
                }
            }
        });

        return { sent: users.length };
    }
);

export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    expireUnpaidBookings,
    sendBookingConfirmationEmail,
    sendShowReminders,
    markNoShowBookings,
    sendNewShowNotifications
];
