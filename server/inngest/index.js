import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../configs/nodeMailer.js";

// Khởi tạo client Inngest để xử lý các background jobs (tiến trình chạy ngầm)
export const inngest = new Inngest({ id: "movie-ticket-booking" });

// Đồng bộ dữ liệu: Tạo mới người dùng từ Clerk vào Database
const syncUserCreation = inngest.createFunction(
    { 
        id: 'sync-user-from-clerk',
        triggers: { event: 'clerk/user.created' }
    },
    async ({ event }) => {
        const { id, first_name, last_name, email_addresses, image_url } = event.data;
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: first_name + ' ' + last_name,
            image: image_url
        };
        await User.create(userData);
    }
);

// Đồng bộ dữ liệu: Xóa người dùng khỏi Database khi xóa trên Clerk
const syncUserDeletion = inngest.createFunction(
    { 
        id: 'delete-user-with-clerk',
        triggers: { event: 'clerk/user.deleted' }
    },
    async ({ event }) => {
        const { id } = event.data;
        await User.findByIdAndDelete(id);
    }
);

// Đồng bộ dữ liệu: Cập nhật thông tin người dùng từ Clerk
const syncUserUpdation = inngest.createFunction(
    { 
        id: 'update-user-from-clerk',
        triggers: { event: 'clerk/user.updated' }
    },
    async ({ event }) => {
        const { id, first_name, last_name, email_addresses, image_url } = event.data;
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: first_name + ' ' + last_name,
            image: image_url
        };
        await User.findByIdAndUpdate(id, userData);
    }
);

// Tự động hủy hóa đơn và nhả ghế nếu không thanh toán sau 5 phút
const releaseSeatsAndDeleteBooking = inngest.createFunction(
    { 
        id: 'release-seats-delete-booking',
        triggers: { event: "app/checkpayment" }
    },
    async ({ event, step }) => {
        // Hẹn giờ chờ 5 phút
        const fiveMinutesLater = new Date(Date.now() + 2 * 60 * 1000);
        await step.sleepUntil('wait-for-5-minutes', fiveMinutesLater);

        await step.run('check-payment-status', async () => {
            const bookingId = event.data.bookingId;
            const booking = await Booking.findById(bookingId);

            // Nếu hóa đơn chưa được thanh toán, tiến hành nhả ghế và xóa hóa đơn
            if (booking && !booking.isPaid) {
                const validShowId = booking.show._id ? booking.show._id.toString() : booking.show.toString();
                const show = await Show.findById(validShowId);

                if (show) {
                    booking.bookedSeats.forEach((seat) => {
                        if (show.heldSeats) {
                            delete show.heldSeats[seat];
                        }
                    });
                    show.markModified('heldSeats');
                    await show.save();

                    // Phát tín hiệu Socket báo nhả ghế cho các client đang mở màn hình đặt vé
                    if (global.io) {
                        global.io.to(validShowId).emit('seats_released', booking.bookedSeats);
                        console.log(`[Socket] Đã phát tín hiệu nhả ghế do quá hạn thanh toán!`);
                    }
                }

                await Booking.findByIdAndDelete(booking._id);
            }
        });
    }
);

// Gửi Email xác nhận đặt vé thành công
const sendBookingConfirmationEmail = inngest.createFunction(
    { 
        id: "send-booking-confirmation-email",
        triggers: { event: "app/show.booked" }
    },
    async ({ event, step }) => {
        const { bookingId } = event.data;

        // BẮT BUỘC bọc các tác vụ gọi DB và API bên ngoài vào step.run()
        await step.run('fetch-data-and-send-email', async () => {
            const booking = await Booking.findById(bookingId).populate({
                path: 'show',
                populate: { path: "movie", model: "Movie" }
            }).populate('user');

            await sendEmail({
                to: booking.user.email,
                subject: `Xác nhận đặt vé thành công: ${booking.show.movie.title}`,
                body: `
                  <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
                      <h2>Xin chào ${booking.user.name},</h2>
                      <p>Vé xem phim <strong style="color: #F84565;">${booking.show.movie.title}</strong> của bạn đã được thanh toán và xác nhận thành công.</p>
                      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                          <p style="margin: 0 0 10px 0;"><strong>Ngày chiếu:</strong> ${new Date(booking.show.showDateTime).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
                          <p style="margin: 0;"><strong>Giờ chiếu:</strong> ${new Date(booking.show.showDateTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <p>Chúc bạn có một buổi xem phim vui vẻ!</p>
                      <p>Trân trọng,<br/><strong>Đội ngũ QuickShow</strong></p>
                  </div>
              `
            });
            
            return { success: true }; // Trả về tín hiệu cho Inngest biết step đã xong
        });
    }
);

// Gửi Email nhắc nhở trước giờ chiếu 8 tiếng
const sendShowReminders = inngest.createFunction(
    { 
        id: "send-show-reminders",
        triggers: { cron: "0 * * * *" } // Chạy mỗi giờ 1 lần
    },
    async ({ step }) => {
        const now = new Date();
        const in8Hours = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const windowStart = new Date(in8Hours.getTime() - 60 * 60 * 1000);

        // Chuẩn bị danh sách các email cần gửi
        const reminderTasks = await step.run("prepare-reminder-tasks", async () => {
            const shows = await Show.find({
                showDateTime: { $gte: windowStart, $lte: in8Hours },
            }).populate('movie');

            const tasks = [];

            for (const show of shows) {
                if (!show.movie || !show.occupiedSeats) continue;

                const userIds = [...new Set(Object.values(show.occupiedSeats))];
                if (userIds.length === 0) continue;

                const users = await User.find({ _id: { $in: userIds } }).select("name email");

                for (const user of users) {
                    tasks.push({
                        userEmail: user.email,
                        userName: user.name,
                        movieTitle: show.movie.title,
                        showDateTime: show.showDateTime,
                    });
                }
            }

            return tasks;
        });

        if (reminderTasks.length === 0) {
            return { sent: 0, message: "Không có nhắc nhở nào cần gửi." };
        }

        // Thực hiện gửi hàng loạt email nhắc nhở
        const results = await step.run('send-all-reminders', async () => {
            return await Promise.allSettled(
                reminderTasks.map(task => sendEmail({
                    to: task.userEmail,
                    subject: `Nhắc nhở: Phim "${task.movieTitle}" của bạn sắp bắt đầu!`,
                    body: `
                      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                          <h2>Xin chào ${task.userName},</h2>
                          <p>Đây là lời nhắc nhở tự động từ hệ thống rằng bộ phim của bạn sắp diễn ra:</p>
                          <h3 style="color: #F84565; margin: 10px 0;">"${task.movieTitle}"</h3>
                          <p>
                              Lịch chiếu: <strong>${new Date(task.showDateTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}</strong> ngày <strong>${new Date(task.showDateTime).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</strong>.
                          </p>
                          <p>Phim sẽ bắt đầu sau khoảng <strong>8 tiếng nữa</strong>. Vui lòng sắp xếp thời gian đến rạp đúng giờ nhé!</p>
                          <br/>
                          <p>Chúc bạn xem phim vui vẻ,<br/><strong>Đội ngũ QuickShow</strong></p>
                      </div>
                  `
                }))
            );
        });

        const sent = results.filter(r => r.status === "fulfilled").length;
        const failed = results.length - sent;

        return {
            sent,
            failed,
            message: `Đã gửi ${sent} nhắc nhở, thất bại ${failed}.`
        };
    }
);

// Gửi Email thông báo khi có suất chiếu/phim mới được thêm vào hệ thống
const sendNewShowNotifications = inngest.createFunction(
    { 
        id: "send-new-show-notifications",
        triggers: { event: "app/show.added" }
    },
    async ({ event, step }) => {
        const { movieTitle } = event.data;

        // Bọc DB query vào step
        const users = await step.run('fetch-all-users', async () => {
            return await User.find({}).select("name email").lean();;
        });

        if (!users || users.length === 0) return { message: "Không có user để gửi." };

        // Gửi email hàng loạt song song để tránh timeout
        await step.run('send-emails-to-all-users', async () => {
            for (const user of users) {
                try {
                const subject = `Phim mới đã có mặt tại rạp: ${movieTitle}`;
                const body = `
                  <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                      <h2>Xin chào ${user.name},</h2>
                      <p>Hệ thống vừa cập nhật thêm lịch chiếu cho một bộ phim mới cực hot:</p>
                      <h3 style="color: #F84565; margin: 10px 0;">"${movieTitle}"</h3>
                      <p>Hãy nhanh tay truy cập ứng dụng của chúng tôi để đặt cho mình những vị trí ngồi đẹp nhất nhé!</p>
                      <br/>
                      <p>Trân trọng,<br/><strong>Đội ngũ QuickShow</strong></p>
                  </div>
              `;
              await sendEmail({ to: user.email, subject, body });
            } catch (error) {
                console.error(`[Inngest] Lỗi gửi email phim mới cho ${user.email}:`, error.message);
            }
        }
            return { success: true };
        });
    }
);

export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    releaseSeatsAndDeleteBooking,
    sendBookingConfirmationEmail,
    sendShowReminders,
    sendNewShowNotifications
];