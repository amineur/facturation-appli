import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';
import { EmailLog } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log("[CRON] Checking for scheduled emails...");
        const now = new Date();

        // Setup Transporter
        let transporter: nodemailer.Transporter;
        try {
            if (!process.env.SMTP_HOST && !process.env.SMTP_USER) {
                throw new Error("SMTP Not Configured");
            }
            transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || "smtp.gmail.com",
                port: Number(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
                tls: { rejectUnauthorized: false }
            });
            await transporter.verify();
        } catch (e) {
            console.warn("[CRON] Main SMTP failed, using Ethereal fallback");
            const testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
        }

        const processItems = async (items: any[], type: 'facture' | 'devis') => {
            const results = [];
            for (const item of items) {
                let emails: EmailLog[] = [];
                try {
                    emails = JSON.parse(item.emailsJSON);
                } catch (e) { continue; }

                let modified = false;

                for (const email of emails) {
                    if (email.status === 'scheduled' && email.scheduledAt && new Date(email.scheduledAt) <= now) {
                        try {
                            const attachments = email.attachments?.map((att: any) => ({
                                filename: att.name,
                                content: Buffer.from(att.content, 'base64'),
                                contentType: att.type
                            })) || [];

                            const mailOptions = {
                                from: process.env.SMTP_FROM || '"Facturation App" <no-reply@example.com>',
                                to: email.to,
                                subject: email.subject,
                                text: email.message,
                                html: email.message.replace(/\n/g, '<br>'),
                                attachments
                            };

                            const info = await transporter.sendMail(mailOptions);

                            email.status = 'sent';
                            email.date = new Date().toISOString();

                            // Clear content to save space
                            email.attachments = email.attachments?.map(att => ({
                                name: att.name,
                                type: att.type,
                                size: att.content ? Math.ceil((att.content as string).length * 3 / 4) : undefined
                            }));

                            modified = true;
                            results.push({ id: email.id, type, itemId: item.id, status: 'sent', info: info.messageId });

                        } catch (err: any) {
                            console.error(`[CRON] Failed to send email ${email.id}:`, err);
                            email.status = 'failed';
                            email.message += `\n\n[ERREUR ENVOI DIFFÉRÉ]: ${err.message}`;
                            modified = true;
                            results.push({ id: email.id, type, itemId: item.id, status: 'failed', error: err.message });
                        }
                    }
                }

                if (modified) {
                    if (type === 'facture') {
                        await prisma.facture.update({
                            where: { id: item.id },
                            data: { emailsJSON: JSON.stringify(emails) }
                        });
                    } else {
                        await prisma.devis.update({
                            where: { id: item.id },
                            data: { emailsJSON: JSON.stringify(emails) }
                        });
                    }
                }
            }
            return results;
        };

        // 1. Fetch Invoices
        const invoices = await prisma.facture.findMany({
            where: { emailsJSON: { contains: '"status":"scheduled"' } }
        });

        // 2. Fetch Quotes
        const quotes = await prisma.devis.findMany({
            where: { emailsJSON: { contains: '"status":"scheduled"' } }
        });

        const invoiceResults = await processItems(invoices, 'facture');
        const quoteResults = await processItems(quotes, 'devis');

        const allResults = [...invoiceResults, ...quoteResults];

        if (allResults.length === 0) {
            return NextResponse.json({ processed: 0, message: "No scheduled emails found due now" });
        }

        return NextResponse.json({ success: true, processed: allResults.length, details: allResults });

    } catch (error: any) {
        console.error("[CRON] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
