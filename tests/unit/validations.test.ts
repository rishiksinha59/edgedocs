/**
 * Tests for authentication validation schemas.
 * Verifies the Zod schemas used by the register and login API routes
 * enforce correct input constraints (email format, password strength, etc.).
 */
import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "@/lib/validations/auth";

describe("registerSchema", () => {
  it("accepts valid registration input", () => {
    const result = registerSchema.safeParse({
      name: "Rishik Sinha",
      email: "rishik@example.com",
      password: "StrongP4ss",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("rishik@example.com");
      expect(result.data.name).toBe("Rishik Sinha");
    }
  });

  it("normalises email to lowercase", () => {
    const result = registerSchema.safeParse({
      name: "User",
      email: "USER@Example.COM",
      password: "StrongP4ss",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("trims whitespace from name", () => {
    const result = registerSchema.safeParse({
      name: "  Rishik  ",
      email: "r@e.com",
      password: "StrongP4ss",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Rishik");
    }
  });

  it("rejects name shorter than 2 characters", () => {
    const result = registerSchema.safeParse({
      name: "R",
      email: "r@e.com",
      password: "StrongP4ss",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      name: "User",
      email: "not-an-email",
      password: "StrongP4ss",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      name: "User",
      email: "user@test.com",
      password: "Short1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase letter", () => {
    const result = registerSchema.safeParse({
      name: "User",
      email: "user@test.com",
      password: "alllowercase1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without digit", () => {
    const result = registerSchema.safeParse({
      name: "User",
      email: "user@test.com",
      password: "NoDigitHere",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without lowercase letter", () => {
    const result = registerSchema.safeParse({
      name: "User",
      email: "user@test.com",
      password: "ALLUPPERCASE1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password longer than 128 characters", () => {
    const result = registerSchema.safeParse({
      name: "User",
      email: "user@test.com",
      password: "A1" + "a".repeat(127),
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid login input", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "anything",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "bad",
      password: "anything",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});
