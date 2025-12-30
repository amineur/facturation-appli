import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';


export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { to, subject, message, attachments, societeId } = body;

        // Validations
        if (!to || !subject || !message) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        let config: any = undefined;

        // If societeId provided, fetch settings
        if (societeId) {
            const societe = await prisma.societe.findUnique({
                where: { id: societeId }
            });

            if (societe) {
                config = {
                    provider: societe.emailProvider || "SMTP",
                    host: societe.smtpHost,
                    port: societe.smtpPort,
                    user: societe.smtpUser,
                    pass: societe.smtpPass, // Encrypted in DB
                    secure: societe.smtpSecure,
                    fromName: societe.nom,
                    fromEmail: societe.smtpFrom || societe.email,
                    googleRefreshToken: societe.googleRefreshToken
                };
            }
        }

        // Send
        const result = await sendEmail({
            to,
            subject,
            html: message.replace(/\n/g, '<br>'),
            text: message,
            attachments
        }, config);

        if (!result.success) {
            console.error("Sending failed:", result.error);
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            messageId: result.messageId,
            previewUrl: result.previewUrl
        });

    } catch (error: any) {
        console.error("Error sending email:", error);
        return NextResponse.json(
            { error: 'Failed to send email', details: error.message },
            { status: 500 }
        );
    }
}
