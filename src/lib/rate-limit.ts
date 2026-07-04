/**
 * Simple in-memory rate limiter using sliding window.
 * For production, replace with Redis-based (e.g., @upstash/ratelimit).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 60_000); // Every minute

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  max: number;
  /** Window duration in seconds */
  windowSec: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowSec * 1000 });
    return { success: true, remaining: config.max - 1, resetAt: now + config.windowSec * 1000 };
  }

  if (entry.count >= config.max) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { success: true, remaining: config.max - entry.count, resetAt: entry.resetAt };
}

/** Rate limit configurations for different route types */
export const RATE_LIMITS = {
  /** General API: 100 requests per minute */
  api: { max: 100, windowSec: 60 },
  /** Auth attempts: 5 per minute */
  auth: { max: 5, windowSec: 60 },
  /** AI endpoints: 20 per minute */
  ai: { max: 20, windowSec: 60 },
  /** Document creation: 10 per minute */
  create: { max: 10, windowSec: 60 },
  /** Version creation: 30 per minute */
  versions: { max: 30, windowSec: 60 },
} as const;

/** Extract IP from request headers */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

/** Helper to create a rate limit error response */
export function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({
      error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
      },
    },
  );
}
