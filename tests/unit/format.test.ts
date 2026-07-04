import { describe, it, expect } from "vitest";
import { formatDistanceToNow } from "@/lib/format";

describe("formatDistanceToNow", () => {
  it("returns 'just now' for less than a minute", () => {
    const date = new Date(Date.now() - 30_000); // 30 seconds ago
    expect(formatDistanceToNow(date)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const date = new Date(Date.now() - 5 * 60_000); // 5 minutes ago
    expect(formatDistanceToNow(date)).toBe("5 minutes ago");
  });

  it("returns singular minute", () => {
    const date = new Date(Date.now() - 60_000); // 1 minute ago
    expect(formatDistanceToNow(date)).toBe("1 minute ago");
  });

  it("returns hours ago", () => {
    const date = new Date(Date.now() - 3 * 3_600_000); // 3 hours ago
    expect(formatDistanceToNow(date)).toBe("3 hours ago");
  });

  it("returns singular hour", () => {
    const date = new Date(Date.now() - 3_600_000); // 1 hour ago
    expect(formatDistanceToNow(date)).toBe("1 hour ago");
  });

  it("returns days ago", () => {
    const date = new Date(Date.now() - 2 * 86_400_000); // 2 days ago
    expect(formatDistanceToNow(date)).toBe("2 days ago");
  });

  it("returns weeks ago", () => {
    const date = new Date(Date.now() - 14 * 86_400_000); // 2 weeks ago
    expect(formatDistanceToNow(date)).toBe("2 weeks ago");
  });

  it("returns formatted date for older than a month", () => {
    const date = new Date(Date.now() - 60 * 86_400_000); // 60 days ago
    const result = formatDistanceToNow(date);
    // Should be a formatted date string like "May 5, 2026"
    expect(result).not.toContain("ago");
    expect(result).toMatch(/\w+ \d+/); // e.g., "May 5"
  });
});
