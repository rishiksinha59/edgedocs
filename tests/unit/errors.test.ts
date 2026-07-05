/**
 * Tests for the custom error class hierarchy.
 * Verifies that AppError subclasses set the correct HTTP status codes,
 * error codes, and that formatErrorResponse serialises them correctly.
 */
import { describe, it, expect } from "vitest";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  PayloadTooLargeError,
  formatErrorResponse,
} from "@/lib/errors";

describe("AppError", () => {
  it("has correct defaults", () => {
    const err = new AppError("something broke");
    expect(err.message).toBe("something broke");
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err).toBeInstanceOf(Error);
  });

  it("accepts custom status and code", () => {
    const err = new AppError("custom", 418, "TEAPOT");
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe("TEAPOT");
  });
});

describe("Error subclasses", () => {
  it("AuthenticationError → 401", () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHENTICATED");
    expect(err).toBeInstanceOf(AppError);
  });

  it("AuthorizationError → 403", () => {
    const err = new AuthorizationError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("NotFoundError → 404 with resource name", () => {
    const err = new NotFoundError("Document");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Document not found");
  });

  it("ValidationError → 400 with field errors", () => {
    const err = new ValidationError("Bad input", {
      email: ["Invalid email address"],
      password: ["Too short", "Missing digit"],
    });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.errors.email).toEqual(["Invalid email address"]);
    expect(err.errors.password).toHaveLength(2);
  });

  it("RateLimitError → 429", () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("RATE_LIMITED");
  });

  it("PayloadTooLargeError → 413", () => {
    const err = new PayloadTooLargeError();
    expect(err.statusCode).toBe(413);
    expect(err.code).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("formatErrorResponse", () => {
  it("formats a basic AppError", () => {
    const err = new AppError("oops", 500, "SERVER_FAIL");
    const body = formatErrorResponse(err);
    expect(body).toEqual({
      error: {
        code: "SERVER_FAIL",
        message: "oops",
      },
    });
  });

  it("includes field errors for ValidationError", () => {
    const err = new ValidationError("Bad", { name: ["Required"] });
    const body = formatErrorResponse(err);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error).toHaveProperty("errors");
    expect((body.error as { errors: Record<string, string[]> }).errors.name).toEqual(["Required"]);
  });

  it("does NOT include field errors for non-ValidationError", () => {
    const err = new AuthenticationError();
    const body = formatErrorResponse(err);
    expect(body.error).not.toHaveProperty("errors");
  });
});
