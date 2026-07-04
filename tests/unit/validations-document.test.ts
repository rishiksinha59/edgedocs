import { describe, it, expect } from "vitest";
import {
  createDocumentSchema,
  updateDocumentSchema,
  addCollaboratorSchema,
  createVersionSchema,
} from "@/lib/validations/document";

describe("Document Validations", () => {
  describe("createDocumentSchema", () => {
    it("accepts valid title", () => {
      const result = createDocumentSchema.safeParse({ title: "My Document" });
      expect(result.success).toBe(true);
    });

    it("uses default title when empty string provided", () => {
      // min(1) means empty string fails
      const result = createDocumentSchema.safeParse({ title: "" });
      expect(result.success).toBe(false);
    });

    it("rejects title over 255 characters", () => {
      const result = createDocumentSchema.safeParse({ title: "a".repeat(256) });
      expect(result.success).toBe(false);
    });

    it("trims whitespace from title", () => {
      const result = createDocumentSchema.safeParse({ title: "  My Doc  " });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("My Doc");
      }
    });
  });

  describe("updateDocumentSchema", () => {
    it("accepts partial update with title", () => {
      const result = updateDocumentSchema.safeParse({ title: "New Title" });
      expect(result.success).toBe(true);
    });

    it("accepts partial update with isArchived", () => {
      const result = updateDocumentSchema.safeParse({ isArchived: true });
      expect(result.success).toBe(true);
    });

    it("accepts empty object", () => {
      const result = updateDocumentSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("rejects non-boolean isArchived", () => {
      const result = updateDocumentSchema.safeParse({ isArchived: "yes" });
      expect(result.success).toBe(false);
    });
  });

  describe("addCollaboratorSchema", () => {
    it("accepts valid editor collaborator", () => {
      const result = addCollaboratorSchema.safeParse({
        email: "collab@example.com",
        role: "editor",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid viewer collaborator", () => {
      const result = addCollaboratorSchema.safeParse({
        email: "collab@example.com",
        role: "viewer",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid role", () => {
      const result = addCollaboratorSchema.safeParse({
        email: "collab@example.com",
        role: "admin",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const result = addCollaboratorSchema.safeParse({
        email: "not-email",
        role: "editor",
      });
      expect(result.success).toBe(false);
    });

    it("normalizes email to lowercase", () => {
      const result = addCollaboratorSchema.safeParse({
        email: "USER@EXAMPLE.COM",
        role: "viewer",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user@example.com");
      }
    });
  });

  describe("createVersionSchema", () => {
    it("accepts empty object", () => {
      const result = createVersionSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts title and description", () => {
      const result = createVersionSchema.safeParse({
        title: "v1.0",
        description: "Initial release",
      });
      expect(result.success).toBe(true);
    });

    it("rejects description over 1000 characters", () => {
      const result = createVersionSchema.safeParse({
        description: "a".repeat(1001),
      });
      expect(result.success).toBe(false);
    });
  });
});
