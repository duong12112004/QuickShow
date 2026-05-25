import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import User from "../models/User.js";
import { inngest } from "../inngest/index.js";
import {
    BOOKING_STATUS,
    PAYMENT_STATUS,
    REFUND_METHOD,
    STATUS_ACTOR,
    cancelBookingAndHandlePayment,
    canAdminCancelBooking,
    checkInBooking,
    reconcileLegacyBookingState,
    syncBookingPaymentWithStripe,
    setBookingStatuses,
    verifyCheckInQrToken
} from "../services/bookingService.js";
import {
    assertNoShowtimeOverlap,
    assertNoLocalShowtimeOverlap,
    assertShowtimeNotInPast,
    buildScheduledShowtimeFilter,
    buildShowtimeSnapshot,
    ensureMovieExists,
    ensureRoomIsActive,
    getShowtimeLifecycle,
    hasBookingsOrHeldSeats,
    SHOWTIME_STATUS,
    serializeAdminShowtime,
    validateCancelShowtimePayload,
    validateCreateShowtimePayload,
    validateUpdateShowtimePayload
} from "../services/showtimeService.js";

const PAID_BOOKING_MATCH = {
    paymentStatus: {
        $in: [
            PAYMENT_STATUS.PAID,
            PAYMENT_STATUS.REFUND_PENDING,
            PAYMENT_STATUS.REFUNDED,
            PAYMENT_STATUS.REFUND_FAILED
        ]
    }
};

const BOOKING_FINAL_STATUSES = [
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.PAYMENT_EXPIRED,
    BOOKING_STATUS.REFUNDED,
    BOOKING_STATUS.NO_SHOW
];

const DASHBOARD_TIMEZONE = "Asia/Ho_Chi_Minh";
const DASHBOARD_RANGE_OPTIONS = [7, 14, 30];
const DASHBOARD_DAY_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

const DASHBOARD_STATUS_LABELS = {
    [BOOKING_STATUS.CONFIRMED]: "Đã xác nhận",
    [BOOKING_STATUS.CHECKED_IN]: "Đã check-in",
    [BOOKING_STATUS.REFUND_PENDING]: "Chờ hoàn tiền",
    [BOOKING_STATUS.REFUNDED]: "Đã hoàn tiền",
    [BOOKING_STATUS.NO_SHOW]: "Vắng mặt",
    [BOOKING_STATUS.CANCELLED]: "Đã hủy",
    [BOOKING_STATUS.PENDING_PAYMENT]: "Chờ thanh toán",
    [BOOKING_STATUS.PAYMENT_EXPIRED]: "Hết hạn thanh toán"
};

const DASHBOARD_STATUS_ORDER = [
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.CHECKED_IN,
    BOOKING_STATUS.REFUND_PENDING,
    BOOKING_STATUS.REFUNDED,
    BOOKING_STATUS.NO_SHOW,
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.PENDING_PAYMENT,
    BOOKING_STATUS.PAYMENT_EXPIRED
];

const parseDashboardRangeDays = (value) => {
    const parsed = Number.parseInt(value, 10);
    return DASHBOARD_RANGE_OPTIONS.includes(parsed) ? parsed : 7;
};

const getDashboardDayStart = (date = new Date()) => {
    const shifted = new Date(date.getTime() + DASHBOARD_UTC_OFFSET_MS);
    const shiftedMidnightUtc = Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth(),
        shifted.getUTCDate()
    );

    return new Date(shiftedMidnightUtc - DASHBOARD_UTC_OFFSET_MS);
};

const formatDateParts = (date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: DASHBOARD_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);

    return parts.reduce((acc, part) => {
        if (part.type !== "literal") {
            acc[part.type] = part.value;
        }
        return acc;
    }, {});
};

const formatDashboardDateKey = (date) => {
    const parts = formatDateParts(date);
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const formatDashboardDateLabel = (date) => {
    const parts = formatDateParts(date);
    return `${parts.day}/${parts.month}`;
};

const getDashboardRange = (rangeDays) => {
    const start = getDashboardDayStart();
    const endExclusive = new Date(start.getTime() + rangeDays * DASHBOARD_DAY_MS);
    const upcomingStart = new Date(Math.max(Date.now(), start.getTime()));

    return {
        start,
        endExclusive,
        upcomingStart,
        days: Array.from({ length: rangeDays }, (_, index) => {
            const date = new Date(start.getTime() + index * DASHBOARD_DAY_MS);
            return {
                date,
                key: formatDashboardDateKey(date),
                label: formatDashboardDateLabel(date)
            };
        })
    };
};

const buildEffectiveRefundExpression = () => ({
    $cond: [
        { $gt: [{ $ifNull: ["$refundAmount", 0] }, 0] },
        { $ifNull: ["$refundAmount", 0] },
        {
            $cond: [
                { $eq: ["$paymentStatus", PAYMENT_STATUS.REFUNDED] },
                { $ifNull: ["$amount", 0] },
                0
            ]
        }
    ]
});

const buildWalletRefundExpression = () => {
    const effectiveRefund = buildEffectiveRefundExpression();

    return {
        $let: {
            vars: {
                effectiveRefund,
                explicitWalletRefund: { $ifNull: ["$walletRefundAmount", null] }
            },
            in: {
                $cond: [
                    { $ne: ["$$explicitWalletRefund", null] },
                    "$$explicitWalletRefund",
                    {
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: ["$refundMethod", REFUND_METHOD.WALLET] },
                                    then: "$$effectiveRefund"
                                },
                                {
                                    case: { $eq: ["$refundMethod", REFUND_METHOD.STRIPE] },
                                    then: 0
                                },
                                {
                                    case: { $eq: ["$refundMethod", REFUND_METHOD.MIXED] },
                                    then: {
                                        $min: [
                                            { $ifNull: ["$walletAmountUsed", 0] },
                                            "$$effectiveRefund"
                                        ]
                                    }
                                },
                                {
                                    case: {
                                        $gt: [
                                            { $strLenCP: { $ifNull: ["$stripeRefundId", ""] } },
                                            0
                                        ]
                                    },
                                    then: 0
                                }
                            ],
                            default: "$$effectiveRefund"
                        }
                    }
                ]
            }
        }
    };
};

const buildStripeRefundExpression = () => {
    const effectiveRefund = buildEffectiveRefundExpression();

    return {
        $let: {
            vars: {
                effectiveRefund,
                explicitStripeRefund: { $ifNull: ["$stripeRefundAmount", null] },
                inferredWalletRefund: {
                    $min: [
                        { $ifNull: ["$walletAmountUsed", 0] },
                        effectiveRefund
                    ]
                }
            },
            in: {
                $cond: [
                    { $ne: ["$$explicitStripeRefund", null] },
                    "$$explicitStripeRefund",
                    {
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: ["$refundMethod", REFUND_METHOD.STRIPE] },
                                    then: "$$effectiveRefund"
                                },
                                {
                                    case: { $eq: ["$refundMethod", REFUND_METHOD.WALLET] },
                                    then: 0
                                },
                                {
                                    case: { $eq: ["$refundMethod", REFUND_METHOD.MIXED] },
                                    then: {
                                        $max: [
                                            { $subtract: ["$$effectiveRefund", "$$inferredWalletRefund"] },
                                            0
                                        ]
                                    }
                                },
                                {
                                    case: {
                                        $gt: [
                                            { $strLenCP: { $ifNull: ["$stripeRefundId", ""] } },
                                            0
                                        ]
                                    },
                                    then: "$$effectiveRefund"
                                }
                            ],
                            default: 0
                        }
                    }
                ]
            }
        }
    };
};

const emitSeatsReleased = (req, showId, seats = []) => {
    const io = req.app.get("io");

    if (io && showId && seats.length > 0) {
        io.to(showId.toString()).emit("seats_released", seats);
    }
};

const buildRevenueMap = async (showIds) => {
    if (showIds.length === 0) {
        return new Map();
    }

    const rows = await Booking.aggregate([
        {
            $match: {
                show: { $in: showIds },
                ...PAID_BOOKING_MATCH
            }
        },
        {
            $group: {
                _id: "$show",
                totalEarnings: { $sum: "$amount" },
                paidBookings: { $sum: 1 }
            }
        }
    ]);

    return new Map(rows.map((row) => [row._id.toString(), row]));
};

const applyInMemoryBookingFilters = (bookings, { q, fromDate, toDate }) => {
    const normalizedQuery = `${q || ""}`.trim().toLowerCase();

    return bookings.filter((booking) => {
        const bookingShowDateTime = booking.showDateTime || booking.show?.showDateTime;

        if (normalizedQuery) {
            const haystack = [
                booking.bookingCode,
                booking.movieTitle || booking.show?.movie?.title,
                booking.roomName || booking.show?.room?.name,
                booking.user?.name,
                booking.user?.email
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            if (!haystack.includes(normalizedQuery)) {
                return false;
            }
        }

        if (fromDate) {
            const from = new Date(fromDate);
            if (!bookingShowDateTime || new Date(bookingShowDateTime) < from) {
                return false;
            }
        }

        if (toDate) {
            const to = new Date(toDate);
            to.setHours(23, 59, 59, 999);

            if (!bookingShowDateTime || new Date(bookingShowDateTime) > to) {
                return false;
            }
        }

        return true;
    });
};

const buildBookingQuery = ({ bookingStatus, paymentStatus }) => {
    const query = {};

    if (bookingStatus) {
        query.bookingStatus = bookingStatus;
    }

    if (paymentStatus) {
        query.paymentStatus = paymentStatus;
    }

    return query;
};

const formatCsvValue = (value) => {
    const safe = `${value ?? ""}`.replace(/"/g, "\"\"");
    return `"${safe}"`;
};

const serializeBookingsToCsv = (bookings) => {
    const headers = [
        "Mã booking",
        "Người dùng",
        "Email",
        "Phim",
        "Phòng",
        "Lịch chiếu",
        "Ghế",
        "Trạng thái booking",
        "Trạng thái thanh toán",
        "Tổng tiền",
        "Thanh toán bằng ví",
        "Thanh toán Stripe",
        "Số tiền hoàn",
        "Phí hủy",
        "Tỷ lệ hoàn",
        "Phương thức hoàn",
        "Lý do hủy",
        "Hoàn tiền lúc",
        "Check-in lúc"
    ];

    const rows = bookings.map((booking) => {
        const effectiveRefundAmount = booking.refundAmount > 0
            ? booking.refundAmount
            : booking.paymentStatus === PAYMENT_STATUS.REFUNDED
                ? booking.amount
                : 0;

        return [
        booking.bookingCode,
        booking.user?.name || "Người dùng đã xóa",
        booking.user?.email || "",
        booking.movieTitle || booking.show?.movie?.title || "",
        booking.roomName || booking.show?.room?.name || "",
        booking.showDateTime || booking.show?.showDateTime
            ? new Date(booking.showDateTime || booking.show?.showDateTime).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
            : "",
        booking.bookedSeats.join(", "),
        booking.bookingStatus,
        booking.paymentStatus,
        booking.amount,
        booking.walletAmountUsed || 0,
        booking.stripeAmount || 0,
        effectiveRefundAmount,
        booking.refundFeeAmount || 0,
        booking.refundRate ? `${Math.round(booking.refundRate * 100)}%` : "",
        booking.refundMethod || "",
        booking.cancelReason || "",
        booking.refundedAt ? new Date(booking.refundedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "",
        booking.checkedInAt ? new Date(booking.checkedInAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : ""
        ].map(formatCsvValue).join(",");
    });

    return `\uFEFF${headers.map(formatCsvValue).join(",")}\n${rows.join("\n")}`;
};

const getAdminUserId = (req) => req.auth?.()?.userId || "admin";

export const isAdmin = async (req, res) => {
    res.json({ success: true, isAdmin: true });
};

export const getDashboardData = async (req, res) => {
    try {
        const rangeDays = parseDashboardRangeDays(req.query?.rangeDays);
        const { start, endExclusive, upcomingStart, days } = getDashboardRange(rangeDays);
        const rangeMatch = { showDateTime: { $gte: start, $lt: endExclusive } };
        const paidRangeMatch = {
            ...PAID_BOOKING_MATCH,
            ...rangeMatch
        };
        const effectiveRefund = buildEffectiveRefundExpression();
        const walletRefund = buildWalletRefundExpression();
        const stripeRefund = buildStripeRefundExpression();

        const [
            [summary],
            revenueTrendRows,
            bookingStatusRows,
            topMovieRows,
            scheduledShows,
            totalUser
        ] = await Promise.all([
            Booking.aggregate([
                { $match: paidRangeMatch },
                {
                    $addFields: {
                        effectiveRefund,
                        settledRefund: {
                            $cond: [
                                { $eq: ["$paymentStatus", PAYMENT_STATUS.REFUNDED] },
                                effectiveRefund,
                                0
                            ]
                        },
                        pendingRefundAmount: {
                            $cond: [
                                { $eq: ["$paymentStatus", PAYMENT_STATUS.REFUND_PENDING] },
                                effectiveRefund,
                                0
                            ]
                        },
                        settledWalletRefund: {
                            $cond: [
                                { $eq: ["$paymentStatus", PAYMENT_STATUS.REFUNDED] },
                                walletRefund,
                                0
                            ]
                        },
                        settledStripeRefund: {
                            $cond: [
                                { $eq: ["$paymentStatus", PAYMENT_STATUS.REFUNDED] },
                                stripeRefund,
                                0
                            ]
                        },
                        ticketCount: {
                            $size: { $ifNull: ["$bookedSeats", []] }
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalBookings: { $sum: 1 },
                        totalTickets: { $sum: "$ticketCount" },
                        grossRevenue: { $sum: { $ifNull: ["$amount", 0] } },
                        totalRefunds: { $sum: "$settledRefund" },
                        walletRefunds: { $sum: "$settledWalletRefund" },
                        stripeRefunds: { $sum: "$settledStripeRefund" },
                        refundPendingAmount: { $sum: "$pendingRefundAmount" }
                    }
                }
            ]),
            Booking.aggregate([
                { $match: paidRangeMatch },
                {
                    $addFields: {
                        settledRefund: {
                            $cond: [
                                { $eq: ["$paymentStatus", PAYMENT_STATUS.REFUNDED] },
                                effectiveRefund,
                                0
                            ]
                        },
                        ticketCount: {
                            $size: { $ifNull: ["$bookedSeats", []] }
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: "%Y-%m-%d",
                                date: "$showDateTime",
                                timezone: DASHBOARD_TIMEZONE
                            }
                        },
                        grossRevenue: { $sum: { $ifNull: ["$amount", 0] } },
                        refundAmount: { $sum: "$settledRefund" },
                        tickets: { $sum: "$ticketCount" },
                        bookings: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Booking.aggregate([
                { $match: paidRangeMatch },
                {
                    $group: {
                        _id: "$bookingStatus",
                        value: { $sum: 1 }
                    }
                }
            ]),
            Booking.aggregate([
                { $match: paidRangeMatch },
                {
                    $addFields: {
                        movieTitleSafe: {
                            $ifNull: ["$movieTitle", "Chưa có tên phim"]
                        },
                        settledRefund: {
                            $cond: [
                                { $eq: ["$paymentStatus", PAYMENT_STATUS.REFUNDED] },
                                effectiveRefund,
                                0
                            ]
                        },
                        ticketCount: {
                            $size: { $ifNull: ["$bookedSeats", []] }
                        }
                    }
                },
                {
                    $group: {
                        _id: "$movieTitleSafe",
                        tickets: { $sum: "$ticketCount" },
                        grossRevenue: { $sum: { $ifNull: ["$amount", 0] } },
                        refundAmount: { $sum: "$settledRefund" }
                    }
                },
                {
                    $addFields: {
                        netRevenue: { $subtract: ["$grossRevenue", "$refundAmount"] }
                    }
                },
                { $sort: { netRevenue: -1, tickets: -1, _id: 1 } },
                { $limit: 6 },
                {
                    $project: {
                        _id: 0,
                        movieTitle: "$_id",
                        tickets: 1,
                        grossRevenue: 1,
                        refundAmount: 1,
                        netRevenue: 1
                    }
                }
            ]),
            Show.find({
                showDateTime: { $gte: upcomingStart, $lt: endExclusive },
                ...buildScheduledShowtimeFilter()
            })
                .populate("movie")
                .populate("room")
                .sort({ showDateTime: 1 }),
            User.countDocuments()
        ]);

        const revenueTrendMap = new Map(
            revenueTrendRows.map((row) => [
                row._id,
                {
                    date: row._id,
                    label: formatDashboardDateLabel(new Date(`${row._id}T00:00:00+07:00`)),
                    grossRevenue: row.grossRevenue || 0,
                    refundAmount: row.refundAmount || 0,
                    netRevenue: Math.max((row.grossRevenue || 0) - (row.refundAmount || 0), 0),
                    tickets: row.tickets || 0,
                    bookings: row.bookings || 0
                }
            ])
        );

        const revenueTrend = days.map((day) => (
            revenueTrendMap.get(day.key) || {
                date: day.key,
                label: day.label,
                grossRevenue: 0,
                refundAmount: 0,
                netRevenue: 0,
                tickets: 0,
                bookings: 0
            }
        ));

        const bookingStatusBreakdown = bookingStatusRows
            .map((row) => ({
                status: row._id,
                label: DASHBOARD_STATUS_LABELS[row._id] || row._id,
                value: row.value || 0
            }))
            .sort((a, b) => {
                const left = DASHBOARD_STATUS_ORDER.indexOf(a.status);
                const right = DASHBOARD_STATUS_ORDER.indexOf(b.status);
                return (left === -1 ? 999 : left) - (right === -1 ? 999 : right);
            });

        const revenueMap = await buildRevenueMap(scheduledShows.map((showtime) => showtime._id));
        const now = new Date();
        const upcomingShows = scheduledShows.slice(0, 8).map((showtime) => {
            const baseShowtime = serializeAdminShowtime(showtime, now);
            const totals = revenueMap.get(showtime._id.toString());

            return {
                _id: baseShowtime._id,
                movie: baseShowtime.movie,
                room: baseShowtime.room,
                showDateTime: baseShowtime.showDateTime,
                basePrice: baseShowtime.basePrice,
                soldSeatCount: baseShowtime.soldSeatCount,
                heldSeatCount: baseShowtime.heldSeatCount,
                totalEarnings: totals?.totalEarnings || 0
            };
        });

        const grossRevenue = summary?.grossRevenue || 0;
        const totalRefunds = summary?.totalRefunds || 0;
        const walletRefunds = summary?.walletRefunds || 0;
        const stripeRefunds = summary?.stripeRefunds || 0;
        const netRevenue = Math.max(grossRevenue - totalRefunds, 0);

        const dashboardData = {
            rangeDays,
            totalBookings: summary?.totalBookings || 0,
            totalTickets: summary?.totalTickets || 0,
            totalRevenue: netRevenue,
            grossRevenue,
            netRevenue,
            totalRefunds,
            walletRefunds,
            stripeRefunds,
            refundPendingAmount: summary?.refundPendingAmount || 0,
            activeShows: scheduledShows.length,
            totalUser,
            revenueTrend,
            bookingStatusBreakdown,
            topMovies: topMovieRows,
            upcomingShows
        };

        res.json({ success: true, dashboardData });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tải dữ liệu dashboard: " + error.message });
    }
};

export const getAdminShowtimes = async (req, res) => {
    try {
        const showtimes = await Show.find({})
            .populate("movie")
            .populate("room")
            .sort({ showDateTime: 1 });

        const revenueMap = await buildRevenueMap(showtimes.map((showtime) => showtime._id));
        const now = new Date();

        const items = showtimes.map((showtime) => {
            const summary = revenueMap.get(showtime._id.toString());
            return {
                ...serializeAdminShowtime(showtime, now),
                totalEarnings: summary?.totalEarnings || 0,
                paidBookings: summary?.paidBookings || 0
            };
        });

        res.json({ success: true, showtimes: items });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tải danh sách suất chiếu: " + error.message });
    }
};

export const getAllShows = getAdminShowtimes;

export const createShowtime = async (req, res) => {
    try {
        const { movieId, roomId, basePrice, cleanupMinutes, showtimes } = validateCreateShowtimePayload(req.body);
        await ensureRoomIsActive(roomId);
        const movie = await ensureMovieExists(movieId);

        const docs = [];
        for (const showDateTime of showtimes) {
            assertShowtimeNotInPast(showDateTime);
            assertNoLocalShowtimeOverlap({
                draftShowtimes: docs,
                showDateTime,
                runtimeMinutes: movie.runtime,
                cleanupMinutes
            });
            await assertNoShowtimeOverlap({
                roomId,
                showDateTime,
                runtimeMinutes: movie.runtime,
                cleanupMinutes
            });

            docs.push(buildShowtimeSnapshot({
                movieId,
                roomId,
                showDateTime,
                basePrice,
                runtimeMinutes: movie.runtime,
                cleanupMinutes
            }));
        }

        const created = await Show.insertMany(docs);

        await inngest.send({
            name: "app/show.added",
            data: { movieTitle: movie.title }
        });

        res.json({
            success: true,
            message: docs.length > 1 ? "Đã tạo các suất chiếu thành công." : "Đã tạo suất chiếu thành công.",
            showtimes: created
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tạo suất chiếu: " + error.message });
    }
};

export const updateShowtime = async (req, res) => {
    try {
        const { showId } = req.params;
        const updates = validateUpdateShowtimePayload(req.body);
        const showtime = await Show.findById(showId).populate("movie").populate("room");

        if (!showtime) {
            return res.json({ success: false, message: "Suất chiếu không tồn tại." });
        }

        if ((showtime.status || SHOWTIME_STATUS.SCHEDULED) === SHOWTIME_STATUS.CANCELLED) {
            return res.json({ success: false, message: "Suất chiếu đã hủy, không thể chỉnh sửa." });
        }

        const lifecycle = getShowtimeLifecycle(showtime);
        if (lifecycle !== "UPCOMING") {
            return res.json({ success: false, message: "Chỉ có thể sửa suất chiếu sắp tới." });
        }

        if (hasBookingsOrHeldSeats(showtime)) {
            return res.json({
                success: false,
                message: "Suất chiếu đã có vé bán ra hoặc đang giữ chỗ. Hãy hủy suất thay vì chỉnh sửa."
            });
        }

        const movie = updates.movieId ? await ensureMovieExists(updates.movieId) : showtime.movie;
        const roomId = updates.roomId || showtime.room._id;
        const showDateTime = updates.showDateTime || showtime.showDateTime;
        const cleanupMinutes = updates.cleanupMinutes ?? showtime.cleanupMinutes;
        const basePrice = updates.basePrice ?? showtime.basePrice;

        await ensureRoomIsActive(roomId);
        assertShowtimeNotInPast(showDateTime);
        await assertNoShowtimeOverlap({
            roomId,
            showDateTime,
            runtimeMinutes: movie.runtime,
            cleanupMinutes,
            excludeShowtimeId: showtime._id
        });

        showtime.movie = movie._id;
        showtime.room = roomId;
        showtime.showDateTime = new Date(showDateTime);
        showtime.runtimeMinutes = movie.runtime;
        showtime.cleanupMinutes = cleanupMinutes;
        showtime.endDateTime = buildShowtimeSnapshot({
            movieId: movie._id,
            roomId,
            showDateTime,
            basePrice,
            runtimeMinutes: movie.runtime,
            cleanupMinutes
        }).endDateTime;
        showtime.basePrice = basePrice;
        await showtime.save();

        res.json({ success: true, message: "Đã cập nhật suất chiếu thành công." });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi cập nhật suất chiếu: " + error.message });
    }
};

export const cancelShowtime = async (req, res) => {
    try {
        const { showId } = req.params;
        const { cancellationReason } = validateCancelShowtimePayload(req.body);
        const showtime = await Show.findById(showId);

        if (!showtime) {
            return res.json({ success: false, message: "Suất chiếu không tồn tại." });
        }

        if ((showtime.status || SHOWTIME_STATUS.SCHEDULED) === SHOWTIME_STATUS.CANCELLED) {
            return res.json({ success: false, message: "Suất chiếu này đã được hủy trước đó." });
        }

        const lifecycle = getShowtimeLifecycle(showtime);
        if (lifecycle === "ENDED") {
            return res.json({ success: false, message: "Không thể hủy suất chiếu đã kết thúc." });
        }

        showtime.status = SHOWTIME_STATUS.CANCELLED;
        showtime.cancellationReason = cancellationReason;
        showtime.cancelledAt = new Date();
        showtime.heldSeats = {};
        showtime.markModified("heldSeats");
        await showtime.save();

        const bookings = await Booking.find({
            show: showtime._id,
            bookingStatus: { $nin: BOOKING_FINAL_STATUSES }
        });

        let refundedCount = 0;
        let failedRefundCount = 0;
        let cancelledCount = 0;
        const releasedSeats = [];

        for (const booking of bookings) {
            try {
                const result = await cancelBookingAndHandlePayment(booking, {
                    actor: STATUS_ACTOR.SYSTEM,
                    cancelledBy: "SYSTEM",
                    reason: `Suất chiếu bị hủy: ${cancellationReason}`
                });

                if (result.refund) {
                    refundedCount += 1;
                } else {
                    cancelledCount += 1;
                }

                releasedSeats.push(...(result.releasedSeats || []));
            } catch (error) {
                failedRefundCount += 1;
            }

            try {
                await inngest.send({
                    name: "app/show.cancelled.booking",
                    data: {
                        bookingId: booking._id.toString(),
                        showtimeId: showtime._id.toString(),
                        cancellationReason
                    }
                });
            } catch (emailEventError) {
                console.error(`[Inngest] Không thể tạo email hủy suất chiếu cho booking ${booking._id}:`, emailEventError.message);
            }
        }

        emitSeatsReleased(req, showtime._id, [...new Set(releasedSeats)]);

        res.json({
            success: true,
            message: `Đã hủy suất chiếu thành công. Hoàn tiền ${refundedCount} booking, hủy ${cancelledCount} booking chờ thanh toán${failedRefundCount ? `, ${failedRefundCount} booking hoàn tiền thất bại` : ""}.`
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi hủy suất chiếu: " + error.message });
    }
};

export const deleteShowtime = async (req, res) => {
    try {
        const { showId } = req.params;
        const showtime = await Show.findById(showId);

        if (!showtime) {
            return res.json({ success: false, message: "Suất chiếu không tồn tại." });
        }

        if (hasBookingsOrHeldSeats(showtime)) {
            return res.json({
                success: false,
                message: "Không thể xóa suất chiếu đã có vé bán ra hoặc đang giữ chỗ."
            });
        }

        const lifecycle = getShowtimeLifecycle(showtime);
        if (lifecycle !== "UPCOMING" && lifecycle !== "CANCELLED") {
            return res.json({ success: false, message: "Chỉ có thể xóa suất chiếu chưa diễn ra." });
        }

        await Show.findByIdAndDelete(showId);

        res.json({ success: true, message: "Đã xóa suất chiếu thành công." });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi xóa suất chiếu: " + error.message });
    }
};

export const getAllBookings = async (req, res) => {
    try {
        const query = buildBookingQuery(req.query);
        const bookings = await Booking.find(query)
            .populate("user")
            .populate({
                path: "show",
                populate: [{ path: "movie" }, { path: "room" }]
            })
            .sort({ createdAt: -1 });

        for (const booking of bookings) {
            try {
                await reconcileLegacyBookingState(booking);
                await syncBookingPaymentWithStripe(booking);
            } catch (error) {
                console.error(`[Sync Stripe] Không thể đồng bộ booking ${booking._id}:`, error.message);
            }
        }

        const filteredBookings = applyInMemoryBookingFilters(bookings, req.query);

        res.json({ success: true, bookings: filteredBookings });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi tải danh sách đặt vé: " + error.message });
    }
};

export const exportBookingsCsv = async (req, res) => {
    try {
        const query = buildBookingQuery(req.query);
        const bookings = await Booking.find(query)
            .populate("user")
            .populate({
                path: "show",
                populate: [{ path: "movie" }, { path: "room" }]
            })
            .sort({ createdAt: -1 });

        const filteredBookings = applyInMemoryBookingFilters(bookings, req.query);
        const csv = serializeBookingsToCsv(filteredBookings);

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename=booking-report-${Date.now()}.csv`);
        res.send(csv);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi khi xuất báo cáo booking: " + error.message });
    }
};

export const cancelAdminBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const cancelReason = `${req.body?.cancelReason || ""}`.trim();

        if (!cancelReason) {
            return res.json({ success: false, message: "Vui lòng nhập lý do hủy booking." });
        }

        const booking = await Booking.findById(bookingId).populate("show");

        if (!booking) {
            return res.json({ success: false, message: "Không tìm thấy booking." });
        }

        if (!canAdminCancelBooking(booking)) {
            return res.json({
                success: false,
                message: "Booking này không còn đủ điều kiện để hủy."
            });
        }

        const result = await cancelBookingAndHandlePayment(booking, {
            actor: STATUS_ACTOR.ADMIN,
            cancelledBy: "ADMIN",
            reason: cancelReason
        });

        emitSeatsReleased(req, booking.show?._id || booking.show, result.releasedSeats || []);

        try {
            await inngest.send({
                name: "app/booking.cancelled",
                data: {
                    bookingId: result.booking._id.toString(),
                    cancelledBy: "ADMIN",
                    reason: cancelReason
                }
            });
        } catch (emailEventError) {
            console.error(`[Inngest] Không thể tạo email hủy booking ${result.booking._id}:`, emailEventError.message);
        }

        res.json({
            success: true,
            message: result.refund
                ? `Đã hủy booking và hoàn ${Math.round((result.refundRate || 0) * 100)}% vào ví QuickShow: ${(result.refundAmount || 0).toLocaleString("vi-VN")} VND.`
                : "Đã hủy booking thành công.",
            refund: {
                amount: result.refundAmount || 0,
                feeAmount: result.refundFeeAmount || 0,
                rate: result.refundRate || 0,
                method: result.refundPolicy?.refundMethod || ""
            }
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi hủy booking: " + error.message });
    }
};

export const checkInBookingByCode = async (req, res) => {
    try {
        const bookingCode = `${req.body?.bookingCode || ""}`.trim().toUpperCase();

        if (!bookingCode) {
            return res.json({ success: false, message: "Vui lòng nhập mã booking." });
        }

        const booking = await Booking.findOne({ bookingCode }).populate("show").populate("user");

        if (!booking) {
            return res.json({ success: false, message: "Không tìm thấy booking với mã đã nhập." });
        }

        await checkInBooking(booking, {
            checkedInBy: getAdminUserId(req),
            method: "BOOKING_CODE",
            actor: STATUS_ACTOR.ADMIN
        });

        res.json({
            success: true,
            message: "Check-in thành công.",
            booking: {
                bookingCode: booking.bookingCode,
                movieTitle: booking.movieTitle,
                roomName: booking.roomName,
                bookedSeats: booking.bookedSeats,
                userName: booking.user?.name || "Khách hàng",
                checkedInAt: booking.checkedInAt
            }
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi check-in booking: " + error.message });
    }
};

export const checkInBookingByQr = async (req, res) => {
    try {
        const qrToken = `${req.body?.qrToken || ""}`.trim();

        if (!qrToken) {
            return res.json({ success: false, message: "Vui lòng quét QR check-in." });
        }

        const payload = verifyCheckInQrToken(qrToken);
        const booking = await Booking.findOne({
            _id: payload.bookingId,
            bookingCode: payload.bookingCode
        }).populate("show").populate("user");

        if (!booking) {
            return res.json({ success: false, message: "Không tìm thấy booking từ QR." });
        }

        const bookingShowId = booking.show?._id?.toString?.() || booking.show?.toString?.() || "";
        if (payload.showId !== bookingShowId) {
            return res.json({ success: false, message: "QR không khớp với suất chiếu của booking." });
        }

        await checkInBooking(booking, {
            checkedInBy: getAdminUserId(req),
            method: "QR",
            actor: STATUS_ACTOR.ADMIN
        });

        res.json({
            success: true,
            message: "Check-in QR thành công.",
            booking: {
                bookingCode: booking.bookingCode,
                movieTitle: booking.movieTitle,
                roomName: booking.roomName,
                bookedSeats: booking.bookedSeats,
                userName: booking.user?.name || "Khách hàng",
                checkedInAt: booking.checkedInAt
            }
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Lỗi khi check-in QR: " + error.message });
    }
};
