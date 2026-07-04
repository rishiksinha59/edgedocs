import { describe, it, expect } from "vitest";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  PayloadTooLargeError,
} from "@/lib/errors";

describe("Error Classes", () => {
  describe("AppError", () => {
    it("creates error with defaults", () => {
      const err = new AppError("Something went wrong");
      expect(err.message).toBe("Something went wrong");
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe("INTERNAL_ERROR");
      expect(err.name).toBe("AppError");
    });

    it("creates error with custom status and code", () => {
      const err = new AppError("Custom", 418, "TEAPOT");
      expect(err.statusCode).toBe(418);
      expect(err.code).toBe("TEAPOT");
    });

    it("is instance of Error", () => {
      const err = new AppError("test");
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe("AuthenticationError", () => {
    it("has 401 status", () => {
      const err = new AuthenticationError();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe("UNAUTHENTICATED");
      expect(err.message).toBe("Authentication required");
    });
  });

  describe("AuthorizationError", () => {
    it("has 403 status", () => {
      const err = new AuthorizationError();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("UNAUTHORIZED");
    });
  });

  describe("NotFoundError", () => {
    it("has 404 status with resource name", () => {
      const err = new NotFoundError("Document");
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Document not found");
    });
  });

  describe("ValidationError", () => {
    it("has 400 status with error details", () => {
      const err = new ValidationError("Bad input", { email: ["Invalid email"] });
      expect(err.statusCode).toBe(400);
      expect(err.errors).toEqual({ email: ["Invalid email"] });
    });
  });

  describe("RateLimitError", () => {
    it("has 429 status", () => {
      const err = new RateLimitError();
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe("RATE_LIMITED");
    });
  });

  describe("PayloadTooLargeError", () => {
    it("has 413 status", () => {
      const err = new PayloadTooLargeError();
      expect(err.statusCode).toBe(413);
      expect(err.code).toBe("PAYLOAD_TOO_LARGE");
    });
  });
});
