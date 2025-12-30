import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { EmailLog, Facture, Devis } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const now = new Date();
        const results = {
            processed: 0,
            errors: 0,
            details: [] as string[]
        };

        // 1. Fetch potential candidates (heuristic: emailsJSON contains "scheduled")
        // We check both Facture and Devis
        const [invoices, quotes] = await Promise.all([
            prisma.facture.findMany({
                where: {
                    emailsJSON: { contains: '"status":"scheduled"' },
                    deletedAt: null,
                    statut: { not: 'Archivée' }
                },
                include: { societe: true }
            }),
            prisma.devis.findMany({
                where: {
                    emailsJSON: { contains: '"status":"scheduled"' },
                    deletedAt: null
                },
                include: { societe: true }
            })
        ]);

        const allDocs = [...invoices.map(i => ({ ...i, type: 'Facture' })), ...quotes.map(q => ({ ...q, type: 'Devis' }))];

        console.log(`[CRON] Found ${allDocs.length} documents with potential scheduled emails.`);

        for (const doc of allDocs) {
            let emails: EmailLog[] = [];
            try {
                emails = JSON.parse(doc.emailsJSON);
            } catch (e) {
                console.error(`[CRON] Failed to parse JSON for ${doc.type} ${doc.id}`);
                continue;
            }

            let modified = false;

            for (const email of emails) {
                if (email.status === 'scheduled' && email.scheduledAt) {
                    const scheduleDate = new Date(email.scheduledAt);

                    if (scheduleDate <= now) {
                        // IT'S TIME!
                        console.log(`[CRON] Processing email for ${doc.numero} scheduled at ${email.scheduledAt}`);

                        // Configure SMTP using Societe settings
                        const societe = doc.societe;
                        let config: any = undefined;
                        if (societe) {
                            config = {
                                provider: societe.emailProvider || "SMTP",
                                host: societe.smtpHost,
                                port: societe.smtpPort,
                                user: societe.smtpUser,
                                pass: societe.smtpPass,
                                secure: societe.smtpSecure,
                                fromName: societe.nom,
                                fromEmail: societe.smtpFrom || societe.email,
                                googleRefreshToken: societe.googleRefreshToken
                            };
                        }

                        // Send Email
                        const result = await sendEmail({
                            to: email.to,
                            subject: email.subject,
                            html: email.message.replace(/\n/g, '<br>'),
                            text: email.message,
                            // Rehydrate attachments from log
                            attachments: email.attachments?.map(att => ({
                                filename: att.name,
                                content: att.content, // Currently stored as base64 in log
                                encoding: 'base64'
                            }))
                        }, config);

                        if (result.success) {
                            email.status = 'sent';
                            email.sentAt = new Date().toISOString();
                            email.messageId = result.messageId;
                            // Clear heavy content if desired, but keeping record is safer for now
                            // email.attachments = email.attachments?.map(a => ({ name: a.name, type: a.type })); 
                            modified = true;
                            results.processed++;
                            results.details.push(`${doc.type} ${doc.numero}: Sent to ${email.to}`);
                        } else {
                            console.error(`[CRON] Failed to send ${doc.numero}`, result.error);
                            email.status = 'failed';
                            email.error = result.error;
                            modified = true;
                            results.errors++;
                        }
                    }
                }
            }

            if (modified) {
                // Update DB
                const table = doc.type === 'Facture' ? prisma.facture : prisma.devis;
                // @ts-ignore
                await table.update({
                    where: { id: doc.id },
                    data: { emailsJSON: JSON.stringify(emails) }
                });
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error("[CRON] Critical Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
