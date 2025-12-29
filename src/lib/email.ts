
import nodemailer from 'nodemailer';

export async function sendEmail({ to, subject, html, text, attachments = [] }: { to: string, subject: string, html: string, text: string, attachments?: any[] }) {
    try {
        const mailOptions = {
            from: process.env.SMTP_FROM || '"Facturation App" <no-reply@example.com>',
            to,
            subject,
            text,
            html,
            attachments: attachments.map((att: any) => ({
                filename: att.filename,
                content: Buffer.from(att.content, 'base64'),
                contentType: att.contentType || 'application/pdf'
            }))
        };

        if (process.env.SMTP_HOST && process.env.SMTP_USER) {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
                tls: { rejectUnauthorized: false }
            });
            await transporter.verify();
            const info = await transporter.sendMail(mailOptions);
            console.log("Email sent (Real):", info.messageId);
            return { success: true, messageId: info.messageId };
        } else {
            // Fallback to Ethereal
            console.log("SMTP not configured, using Ethereal...");
            const testAccount = await nodemailer.createTestAccount();
            const testTransporter = nodemailer.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
            const info = await testTransporter.sendMail(mailOptions);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log("Email sent (Ethereal):", info.messageId);
            console.log("Preview URL:", previewUrl);
            return { success: true, messageId: info.messageId, previewUrl, warning: "Sent via Ethereal (Dev Mode)" };
        }
    } catch (error: any) {
        console.error("Email sending failed:", error);
        return { success: false, error: error.message };
    }
}
