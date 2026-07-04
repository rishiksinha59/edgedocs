import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "@/lib/validations/auth";

describe("Auth Validations", () => {
  describe("registerSchema", () => {
    it("accepts valid input", () => {
      const result = registerSchema.safeParse({
        name: "John Doe",
        email: "john@example.com",
        password: "SecurePass1",
      });
      expect(result.success).toBe(true);
    });

    it("rejects short name", () => {
      const result = registerSchema.safeParse({
        name: "J",
        email: "john@example.com",
        password: "SecurePass1",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const result = registerSchema.safeParse({
        name: "John",
        email: "not-an-email",
        password: "SecurePass1",
      });
      expect(result.success).toBe(false);
    });

    it("rejects password without uppercase", () => {
      const result = registerSchema.safeParse({
        name: "John",
        email: "john@example.com",
        password: "nouppercase1",
      });
      expect(result.success).toBe(false);
    });

    it("rejects password without number", () => {
      const result = registerSchema.safeParse({
        name: "John",
        email: "john@example.com",
        password: "NoNumberHere",
      });
      expect(result.success).toBe(false);
    });

    it("rejects password shorter than 8 characters", () => {
      const result = registerSchema.safeParse({
        name: "John",
        email: "john@example.com",
        password: "Ab1",
      });
      expect(result.success).toBe(false);
    });

    it("normalizes email to lowercase", () => {
      const result = registerSchema.safeParse({
        name: "John",
        email: "JOHN@EXAMPLE.COM",
        password: "SecurePass1",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("john@example.com");
      }
    });

    it("trims whitespace from name", () => {
      const result = registerSchema.safeParse({
        name: "  John Doe  ",
        email: "john@example.com",
        password: "SecurePass1",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("John Doe");
      }
    });
  });

  describe("loginSchema", () => {
    it("accepts valid input", () => {
      const result = loginSchema.safeParse({
        email: "john@example.com",
        password: "anything",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty password", () => {
      const result = loginSchema.safeParse({
        email: "john@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const result = loginSchema.safeParse({
        email: "invalid",
        password: "anything",
      });
      expect(result.success).toBe(false);
    });
  });
});
