import crypto from 'crypto';

/**
 * Generate a secure random token (32 bytes = 64 hex characters)
 */
export function generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token using SHA-256
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token against its hash
 */
export function verifyToken(token: string, hash: string): boolean {
    return hashToken(token) === hash;
}
