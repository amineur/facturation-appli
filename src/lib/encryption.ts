
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'default-secret-key-change-it-32chars'; // Must be 32 chars
const IV_LENGTH = 16;

// Ensure key is 32 bytes
const getKey = () => {
    const key = String(ENCRYPTION_KEY);
    return crypto.scryptSync(key, 'salt', 32);
};

export function encrypt(text: string): string {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
        console.error("Encryption failed", e);
        return text; // Fallback (or throw)
    }
}

export function decrypt(text: string): string {
    if (!text) return text;
    try {
        const textParts = text.split(':');
        if (textParts.length !== 2) return text; // Not encrypted or invalid format

        const iv = Buffer.from(textParts[0], 'hex');
        const encryptedText = Buffer.from(textParts[1], 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        console.error("Decryption failed", e);
        return text; // Return original if fail (might be unencrypted legacy)
    }
}
