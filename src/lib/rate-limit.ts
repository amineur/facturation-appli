/**
 * Simple in-memory rate limiter
 * In production, use Redis or a proper rate limiting service
 */

interface RateLimitRecord {
    count: number;
    resetAt: number;
}

const attempts = new Map<string, RateLimitRecord>();

/**
 * Check if a key has exceeded the rate limit
 * @param key - Unique identifier (e.g., IP address, email)
 * @param maxAttempts - Maximum number of attempts allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if within limit, false if exceeded
 */
export function checkRateLimit(
    key: string,
    maxAttempts: number = 5,
    windowMs: number = 15 * 60 * 1000 // 15 minutes
): boolean {
    const now = Date.now();
    const record = attempts.get(key);

    // No record or window expired - allow and create new record
    if (!record || now > record.resetAt) {
        attempts.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }

    // Exceeded limit
    if (record.count >= maxAttempts) {
        return false;
    }

    // Within limit - increment count
    record.count++;
    return true;
}

/**
 * Clear rate limit for a key (e.g., after successful action)
 */
export function clearRateLimit(key: string): void {
    attempts.delete(key);
}

/**
 * Clean up expired records (call periodically)
 */
export function cleanupExpiredRecords(): void {
    const now = Date.now();
    for (const [key, record] of attempts.entries()) {
        if (now > record.resetAt) {
            attempts.delete(key);
        }
    }
}

// Auto-cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(cleanupExpiredRecords, 5 * 60 * 1000);
}
