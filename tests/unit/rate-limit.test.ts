import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";

describe("Rate Limiter", () => {
  beforeEach(() => {
    // Rate limiter uses in-memory store, so we need unique keys per test
  });

  it("allows requests within the limit", () => {
    const key = `test-allow-${Date.now()}`;
    const result = rateLimit(key, { max: 5, windowSec: 60 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("tracks remaining count correctly", () => {
    const key = `test-remaining-${Date.now()}`;
    rateLimit(key, { max: 5, windowSec: 60 });
    rateLimit(key, { max: 5, windowSec: 60 });
    const result = rateLimit(key, { max: 5, windowSec: 60 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("rejects requests over the limit", () => {
    const key = `test-reject-${Date.now()}`;
    const config = { max: 3, windowSec: 60 };

    rateLimit(key, config); // 1
    rateLimit(key, config); // 2
    rateLimit(key, config); // 3

    const result = rateLimit(key, config); // 4 — should fail
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", async () => {
    const key = `test-reset-${Date.now()}`;
    // Use a 1ms window so it expires quickly
    const config = { max: 1, windowSec: 0.001 }; // 1ms window

    const result1 = rateLimit(key, config);
    expect(result1.success).toBe(true);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 5));

    const result2 = rateLimit(key, config);
    expect(result2.success).toBe(true);
  });

  it("uses different counters for different keys", () => {
    const key1 = `test-key1-${Date.now()}`;
    const key2 = `test-key2-${Date.now()}`;
    const config = { max: 1, windowSec: 60 };

    rateLimit(key1, config);
    const result = rateLimit(key2, config);
    expect(result.success).toBe(true);
  });

  it("returns resetAt timestamp in the future", () => {
    const key = `test-timestamp-${Date.now()}`;
    const result = rateLimit(key, { max: 5, windowSec: 60 });
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  describe("RATE_LIMITS config", () => {
    it("has AI limit of 20 per minute", () => {
      expect(RATE_LIMITS.ai.max).toBe(20);
      expect(RATE_LIMITS.ai.windowSec).toBe(60);
    });

    it("has auth limit of 5 per minute", () => {
      expect(RATE_LIMITS.auth.max).toBe(5);
      expect(RATE_LIMITS.auth.windowSec).toBe(60);
    });

    it("has document creation limit of 10 per minute", () => {
      expect(RATE_LIMITS.create.max).toBe(10);
      expect(RATE_LIMITS.create.windowSec).toBe(60);
    });
  });

  describe("rateLimitResponse", () => {
    it("returns a 429 Response", () => {
      const resetAt = Date.now() + 30_000;
      const response = rateLimitResponse(resetAt);
      expect(response.status).toBe(429);
    });

    it("includes Retry-After header", () => {
      const resetAt = Date.now() + 30_000;
      const response = rateLimitResponse(resetAt);
      const retryAfter = response.headers.get("Retry-After");
      expect(Number(retryAfter)).toBeGreaterThan(0);
    });

    it("includes rate limit reset header", () => {
      const resetAt = Date.now() + 30_000;
      const response = rateLimitResponse(resetAt);
      const resetHeader = response.headers.get("X-RateLimit-Reset");
      expect(Number(resetHeader)).toBeGreaterThan(0);
    });

    it("returns JSON error body", async () => {
      const resetAt = Date.now() + 30_000;
      const response = rateLimitResponse(resetAt);
      const body = await response.json();
      expect(body.error.code).toBe("RATE_LIMITED");
      expect(body.error.message).toContain("Too many requests");
    });
  });
});
