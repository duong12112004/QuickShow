import Booking from "../models/Booking.js";
import { inngest } from "../inngest/index.js";
import {
    BOOKING_STATUS,
    PAYMENT_STATUS,
    STATUS_ACTOR,
    appendBookingHistory,
    confirmBookingPaid
} from "../services/bookingService.js";
import { verifyZaloPayCallback } from "../services/zalopayService.js";

// Báo realtime để các client đang xem suất chiếu cập nhật ghế đã bán.
const emitBookedSeats = (req, booking) => {
    const io = req.app.get("io");

    if (io) {
        io.to(booking.show.toString()).emit("seats_booked_successfully", booking.bookedSeats);
    }
};

// Nhận callback từ ZaloPay, xác thực MAC và xác nhận booking đã thanh toán.
export const zalopayCallback = async (req, res) => {
    try {
        const { isValid, data } = verifyZaloPayCallback(req.body || {});

        // Không tin dữ liệu callback trước khi chữ ký MAC được xác thực.
        if (!isValid) {
            return res.json({
                return_code: -1,
                return_message: "Invalid mac"
            });
        }

        const booking = await Booking.findOne({ zalopayAppTransId: data.app_trans_id });

        if (!booking) {
            return res.json({
                return_code: 0,
                return_message: "Booking not found"
            });
        }

        booking.zalopayCallbackData = data;
        booking.zalopayZpTransId = `${data.zp_trans_id || booking.zalopayZpTransId || ""}`;

        const paidAmount = Number(data.amount || 0);
        const expectedAmount = Number(booking.stripeAmount || 0);

        // Chặn việc xác nhận booking nếu số tiền callback khác số tiền cần thanh toán.
        if (paidAmount !== expectedAmount) {
            appendBookingHistory(booking, {
                status: booking.bookingStatus,
                paymentStatus: booking.paymentStatus,
                actor: STATUS_ACTOR.ZALOPAY,
                note: `ZaloPay amount mismatch. Expected ${expectedAmount}, received ${paidAmount}.`
            });
            await booking.save();

            return res.json({
                return_code: -1,
                return_message: "Invalid amount"
            });
        }

        if ([PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED].includes(booking.paymentStatus)) {
            await booking.save();
            return res.json({
                return_code: 1,
                return_message: "success"
            });
        }

        if ([BOOKING_STATUS.CANCELLED, BOOKING_STATUS.PAYMENT_EXPIRED, BOOKING_STATUS.REFUNDED].includes(booking.bookingStatus)) {
            await booking.save();
            return res.json({
                return_code: 1,
                return_message: "success"
            });
        }

        // confirmBookingPaid xử lý trạng thái booking và chuyển ghế giữ tạm thành ghế đã bán.
        await confirmBookingPaid(booking, {
            actor: STATUS_ACTOR.ZALOPAY,
            note: "ZaloPay xac nhan thanh toan thanh cong."
        });
        emitBookedSeats(req, booking);

        await inngest.send({
            name: "app/show.booked",
            data: { bookingId: booking._id.toString() }
        });

        res.json({
            return_code: 1,
            return_message: "success"
        });
    } catch (error) {
        console.error("ZaloPay callback error:", error.message);
        res.json({
            return_code: 0,
            return_message: error.message
        });
    }
};
