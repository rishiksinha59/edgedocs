import { z } from "zod";

export const createDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(255).trim().default("Untitled"),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).trim().optional(),
  isArchived: z.boolean().optional(),
});

export const addCollaboratorSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  role: z.enum(["editor", "viewer"], {
    message: "Role must be 'editor' or 'viewer'",
  }),
});

export const createVersionSchema = z.object({
  title: z.string().max(255).trim().optional(),
  description: z.string().max(1000).trim().optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type AddCollaboratorInput = z.infer<typeof addCollaboratorSchema>;
export type CreateVersionInput = z.infer<typeof createVersionSchema>;
