export const bookingStatusMap = {
  PENDING_PAYMENT: { label: "Chờ thanh toán", className: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  CONFIRMED: { label: "Đã xác nhận", className: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" },
  CHECKED_IN: { label: "Đã check-in", className: "bg-sky-500/15 text-sky-300 border border-sky-500/30" },
  CANCELLED: { label: "Đã hủy", className: "bg-rose-500/15 text-rose-300 border border-rose-500/30" },
  PAYMENT_EXPIRED: { label: "Hết hạn thanh toán", className: "bg-slate-500/15 text-slate-300 border border-slate-500/30" },
  REFUND_PENDING: { label: "Đang hoàn tiền", className: "bg-orange-500/15 text-orange-300 border border-orange-500/30" },
  REFUNDED: { label: "Đã hoàn tiền", className: "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30" },
  NO_SHOW: { label: "Không đến xem", className: "bg-zinc-500/15 text-zinc-300 border border-zinc-500/30" }
};

export const paymentStatusMap = {
  UNPAID: { label: "Chưa thanh toán", className: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  PAID: { label: "Đã thanh toán", className: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" },
  EXPIRED: { label: "Đã hết hạn", className: "bg-slate-500/15 text-slate-300 border border-slate-500/30" },
  REFUND_PENDING: { label: "Đang hoàn tiền", className: "bg-orange-500/15 text-orange-300 border border-orange-500/30" },
  REFUNDED: { label: "Đã hoàn tiền", className: "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30" },
  REFUND_FAILED: { label: "Hoàn tiền thất bại", className: "bg-rose-500/15 text-rose-300 border border-rose-500/30" }
};

export const getBookingStatusUi = (status) => {
  return bookingStatusMap[status] || {
    label: status || "Không rõ",
    className: "bg-slate-500/15 text-slate-300 border border-slate-500/30"
  };
};

export const getPaymentStatusUi = (status) => {
  return paymentStatusMap[status] || {
    label: status || "Không rõ",
    className: "bg-slate-500/15 text-slate-300 border border-slate-500/30"
  };
};
