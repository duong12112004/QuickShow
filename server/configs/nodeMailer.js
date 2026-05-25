import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false, // Bắt buộc là false với port 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false // Bỏ qua lỗi xác thực chứng chỉ chéo trên serverless
    },
    connectionTimeout: 5000, // Ép dừng nếu kết nối treo quá 5 giây
    socketTimeout: 5000,
  });

  const sendEmail = async ({ to, subject, body, attachments = [] }) => {
    try {
        const response = await transporter.sendMail({
            from: process.env.SENDER_EMAIL,
            to,
            subject,
            html: body,
            attachments,
        });
        return response;
    } catch (error) {
        console.error(`[Email Error] Lỗi gửi email tới ${to}:`, error);
        throw error; // Bắt buộc ném lỗi ra ngoài để Inngest bắt được và không bị treo "Running"
    }
}

export default sendEmail;
