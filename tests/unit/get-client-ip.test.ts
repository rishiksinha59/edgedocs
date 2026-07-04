import { describe, it, expect } from "vitest";
import { getClientIp } from "@/lib/rate-limit";

describe("getClientIp", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18" },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("extracts IP from x-real-ip header", () => {
    const request = new Request("http://localhost", {
      headers: { "x-real-ip": "203.0.113.50" },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const request = new Request("http://localhost");
    expect(getClientIp(request)).toBe("unknown");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
      },
    });
    expect(getClientIp(request)).toBe("1.1.1.1");
  });

  it("trims whitespace from forwarded IP", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": " 10.0.0.1 , 10.0.0.2" },
    });
    expect(getClientIp(request)).toBe("10.0.0.1");
  });
});
