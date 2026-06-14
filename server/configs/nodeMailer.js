import nodemailer from 'nodemailer'

const smtpPort = Number(process.env.SMTP_PORT || 2525);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
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
        throw error;
    }
}

export default sendEmail;
