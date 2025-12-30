
import nodemailer from 'nodemailer';
import { decrypt } from './encryption';

interface EmailConfig {
    provider: "SMTP" | "GMAIL";
    host?: string;
    port?: number;
    user?: string;
    pass?: string; // Encrypted
    secure?: boolean;
    fromName?: string;
    fromEmail?: string;
    googleRefreshToken?: string; // Encrypted
}

export async function createTransporter(config?: EmailConfig) {
    // 1. Explicit Config (from Society)
    if (config) {
        if (config.provider === "GMAIL" && config.googleRefreshToken) {
            // Gmail OAuth
            return nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    type: 'OAuth2',
                    user: config.fromEmail,
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    refreshToken: decrypt(config.googleRefreshToken),
                },
            });
        }

        // SMTP
        if (config.host && config.user) {
            return nodemailer.createTransport({
                host: config.host,
                port: config.port || 587,
                secure: config.secure || false,
                auth: {
                    user: config.user,
                    pass: config.pass ? decrypt(config.pass) : undefined,
                },
                tls: { rejectUnauthorized: false }
            });
        }
    }

    // 2. Env Fallback (Global SMTP)
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            tls: { rejectUnauthorized: false }
        });
    }

    // 3. Ethereal Fallback (Dev Only)
    console.log("No Email Config found. Using Ethereal.");
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass,
        },
    });
}

export async function sendEmail(
    { to, subject, html, text, attachments = [] }: { to: string, subject: string, html: string, text: string, attachments?: any[] },
    config?: EmailConfig
) {
    try {
        const transporter = await createTransporter(config);

        // Determine 'From' field
        let from = process.env.SMTP_FROM || '"Facturation App" <no-reply@example.com>';
        if (config?.fromEmail) {
            from = config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail;
        }

        const mailOptions = {
            from,
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

        const info = await transporter.sendMail(mailOptions);

        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log("Preview URL:", previewUrl);
        }

        return {
            success: true,
            messageId: info.messageId,
            previewUrl: previewUrl || undefined
        };

    } catch (error: any) {
        console.error("Email sending failed:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Email verification template
 */
export function getEmailVerificationTemplate(verificationUrl: string) {
    return {
        subject: "Valide ton email",
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .button { display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Bienvenue ! 👋</h1>
                    <p>Merci de t'être inscrit. Pour commencer à utiliser ton compte, tu dois valider ton adresse email.</p>
                    <p>Clique sur le bouton ci-dessous pour valider ton email :</p>
                    <a href="${verificationUrl}" class="button">Valider mon email</a>
                    <p>Ou copie ce lien dans ton navigateur :</p>
                    <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
                    <div class="footer">
                        <p>⏱️ Ce lien expire dans 1 heure.</p>
                        <p>Si tu n'as pas créé de compte, ignore cet email.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `Bienvenue !

Merci de t'être inscrit. Pour valider ton email, clique sur ce lien :

${verificationUrl}

Ce lien expire dans 1 heure.

Si tu n'as pas créé de compte, ignore cet email.`
    };
}

/**
 * Password reset template
 */
export function getPasswordResetTemplate(resetUrl: string) {
    return {
        subject: "Réinitialise ton mot de passe",
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
                    .warning { background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Réinitialisation de mot de passe 🔐</h1>
                    <p>Tu as demandé à réinitialiser ton mot de passe. Clique sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                    <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
                    <p>Ou copie ce lien dans ton navigateur :</p>
                    <p style="word-break: break-all; color: #666;">${resetUrl}</p>
                    <div class="warning">
                        <strong>⚠️ Important :</strong> Si tu n'as pas demandé cette réinitialisation, ignore cet email. Ton mot de passe actuel reste inchangé.
                    </div>
                    <div class="footer">
                        <p>⏱️ Ce lien expire dans 1 heure.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `Réinitialisation de mot de passe

Tu as demandé à réinitialiser ton mot de passe. Clique sur ce lien pour créer un nouveau mot de passe :

${resetUrl}

Ce lien expire dans 1 heure.

⚠️ IMPORTANT : Si tu n'as pas demandé cette réinitialisation, ignore cet email. Ton mot de passe actuel reste inchangé.`
    };
}
