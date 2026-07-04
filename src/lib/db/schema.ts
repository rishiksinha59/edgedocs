import { pgTable, uuid, text, timestamp, boolean, integer, customType, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Custom type for bytea columns
const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

// ============================================================
// USERS (managed by Auth.js)
// ============================================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  ownedDocuments: many(documents),
  collaborations: many(documentCollaborators),
}));

// ============================================================
// AUTH.JS TABLES
// ============================================================

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: text("token_type"),
  scope: text("scope"),
  idToken: text("id_token"),
  sessionState: text("session_state"),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("session_token").unique().notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

// ============================================================
// DOCUMENTS
// ============================================================

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull().default("Untitled"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    yjsState: bytea("yjs_state"),
    wordCount: integer("word_count").default(0),
    isArchived: boolean("is_archived").default(false),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    lastEditedBy: uuid("last_edited_by").references(() => users.id),
  },
  (table) => [index("idx_documents_owner").on(table.ownerId), index("idx_documents_updated").on(table.updatedAt)],
);

export const documentsRelations = relations(documents, ({ one, many }) => ({
  owner: one(users, {
    fields: [documents.ownerId],
    references: [users.id],
  }),
  collaborators: many(documentCollaborators),
  versions: many(documentVersions),
}));

// ============================================================
// DOCUMENT COLLABORATORS (RBAC)
// ============================================================

export type DocumentRole = "owner" | "editor" | "viewer";

export const documentCollaborators = pgTable(
  "document_collaborators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<DocumentRole>().notNull(),
    invitedBy: uuid("invited_by").references(() => users.id),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_collaborators_unique").on(table.documentId, table.userId), index("idx_collaborators_user").on(table.userId), index("idx_collaborators_document").on(table.documentId)],
);

export const documentCollaboratorsRelations = relations(documentCollaborators, ({ one }) => ({
  document: one(documents, {
    fields: [documentCollaborators.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [documentCollaborators.userId],
    references: [users.id],
  }),
}));

// ============================================================
// DOCUMENT VERSIONS (Snapshots)
// ============================================================

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    yjsSnapshot: bytea("yjs_snapshot").notNull(),
    yjsStateVector: bytea("yjs_state_vector"),
    title: text("title"),
    description: text("description"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    wordCount: integer("word_count"),
    versionNumber: integer("version_number").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_versions_unique").on(table.documentId, table.versionNumber), index("idx_versions_document").on(table.documentId)],
);

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, {
    fields: [documentVersions.documentId],
    references: [documents.id],
  }),
  creator: one(users, {
    fields: [documentVersions.createdBy],
    references: [users.id],
  }),
}));

// ============================================================
// SYNC STATES (Track per-client sync progress)
// ============================================================

export const syncStates = pgTable(
  "sync_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stateVector: bytea("state_vector"),
    lastSynced: timestamp("last_synced", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_sync_states_unique").on(table.documentId, table.userId), index("idx_sync_states_document").on(table.documentId)],
);
