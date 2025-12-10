import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { to, subject, message, attachments } = body;

        // Validations
        if (!to || !subject || !message) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Email Options
        const mailOptions = {
            from: process.env.SMTP_FROM || '"Facturation App" <no-reply@example.com>',
            to,
            subject,
            text: message, // Plain text version
            html: message.replace(/\n/g, '<br>'), // Simple HTML version
            attachments: attachments ? attachments.map((att: any) => ({
                filename: att.filename,
                content: Buffer.from(att.content, 'base64'),
                contentType: att.contentType || 'application/pdf'
            })) : []
        };

        let info;
        try {
            // Check for critical variables
            if (!process.env.SMTP_HOST && !process.env.SMTP_USER) {
                throw new Error("SMTP_HOST or SMTP_USER not configured");
            }

            // Real Transport
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || "smtp.gmail.com",
                port: Number(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
                tls: { rejectUnauthorized: false }
            });

            await transporter.verify(); // Verify connection first
            info = await transporter.sendMail(mailOptions);
            console.log("Message sent (Real): %s", info.messageId);

        } catch (realError: any) {
            console.warn("Real SMTP failed or not configured, falling back to Ethereal:", realError.message);

            // Fallback to Ethereal
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

            info = await testTransporter.sendMail(mailOptions);
            console.log("Message sent (Ethereal): %s", info.messageId);
            console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

            // Append preview URL to success message if possible
            return NextResponse.json({
                success: true,
                messageId: info.messageId,
                previewUrl: nodemailer.getTestMessageUrl(info),
                warning: "Sent via Ethereal (Dev Mode)"
            });
        }

        return NextResponse.json({ success: true, messageId: info.messageId });

    } catch (error: any) {
        console.error("Error sending email:", error);
        return NextResponse.json(
            { error: 'Failed to send email', details: error.message },
            { status: 500 }
        );
    }
}
