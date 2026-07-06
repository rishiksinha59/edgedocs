/**
 * API-level E2E integration test suite for EdgeDocs.
 *
 * Simulates a full collaborative user flow:
 * 1. User Registration: Create Owner (User A) and Collaborator (User B)
 * 2. Document Creation: User A creates a new document
 * 3. Collaborator Management: User A invites User B to collaborate as an editor
 * 4. Token Generation: Both User A and User B successfully get WebSocket sync tokens
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Ensure a valid signing key exists before route modules load
process.env.COLLABORATION_JWT_SECRET = "test-secret-at-least-32-chars-long-abcdef";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock drizzle db
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock bcrypt
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password-123"),
  },
}));

// Mock rate-limit to avoid blocking rapid test calls
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockReturnValue({ success: true }),
  RATE_LIMITS: { create: {} },
  rateLimitResponse: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// A chainable query builder mock that resolves a queue of predefined database query outputs
class MockQueryBuilder {
  private resultsQueue: any[] = [];

  public mockResult(val: any) {
    this.resultsQueue.push(val);
    return this;
  }

  public clear() {
    this.resultsQueue = [];
  }

  // Drizzle chain methods
  public select = () => this;
  public insert = () => this;
  public update = () => this;
  public delete = () => this;
  public from = () => this;
  public where = () => this;
  public limit = () => this;
  public orderBy = () => this;
  public innerJoin = () => this;
  public leftJoin = () => this;
  public values = () => this;
  public returning = () => this;

  // Promisify the class so it is awaitable (invoked automatically by await statement)
  public then(onfulfilled: any) {
    const nextResult = this.resultsQueue.shift();
    return Promise.resolve(nextResult).then(onfulfilled);
  }
}

describe("E2E API Flow: Registration → Doc Creation → Collaborator Invite → Sync Token", () => {
  const qb = new MockQueryBuilder();

  beforeEach(() => {
    vi.clearAllMocks();
    qb.clear();

    // Bind db methods to the mock query builder
    vi.mocked(db.select).mockImplementation(qb.select as any);
    vi.mocked(db.insert).mockImplementation(qb.insert as any);
    vi.mocked(db.update).mockImplementation(qb.update as any);
    vi.mocked(db.delete).mockImplementation(qb.delete as any);
  });

  it("successfully runs through the complete collaborative document lifecycle", async () => {
    // Dynamically import API route handlers after setting environment variables
    const { POST: registerHandler } = await import("@/app/api/auth/register/route");
    const { POST: createDocHandler } = await import("@/app/api/documents/route");
    const { POST: addCollabHandler } = await import("@/app/api/documents/[id]/collaborators/route");
    const { POST: getSyncTokenHandler } = await import("@/app/api/documents/[id]/sync/route");

    // ----------------------------------------------------
    // STEP 1: User Registration
    // ----------------------------------------------------
    // Queue DB responses for registration:
    // 1. User lookup check (returns [] meaning email is free)
    // 2. User insert returning statement
    qb.mockResult([])
      .mockResult([{ id: "user-a-owner", email: "owner@test.com", name: "Owner User" }]);

    const regResponse = await registerHandler(
      new Request("http://localhost:3000/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: "Owner User",
          email: "owner@test.com",
          password: "StrongP4ssword1",
        }),
      })
    );

    expect(regResponse.status).toBe(201);
    const regData = await regResponse.json();
    expect(regData.user.id).toBe("user-a-owner");
    expect(regData.user.email).toBe("owner@test.com");

    // ----------------------------------------------------
    // STEP 2: Document Creation
    // ----------------------------------------------------
    // Authenticate as User A (Owner)
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: "user-a-owner", email: "owner@test.com", name: "Owner User" },
      expires: "expiry",
    });

    // Queue DB responses for doc creation:
    // 1. Insert document row
    // 2. Insert owner collaborator row
    qb.mockResult([{ id: "doc-uuid-123", title: "E2E Test Document" }])
      .mockResult([{ id: "collab-1", role: "owner" }]);

    const docResponse = await createDocHandler(
      new Request("http://localhost:3000/api/documents", {
        method: "POST",
        body: JSON.stringify({ title: "E2E Test Document" }),
      })
    );

    expect(docResponse.status).toBe(201);
    const docData = await docResponse.json();
    expect(docData.document.id).toBe("doc-uuid-123");
    expect(docData.document.title).toBe("E2E Test Document");

    // ----------------------------------------------------
    // STEP 3: Collaborator Invite
    // ----------------------------------------------------
    // Owner invites User B (collaborator@test.com) as an editor.
    // Queue DB responses for invite flow:
    // 1. Select owner check: current user is the owner of the document
    // 2. Select user lookup: lookup the invited collaborator by email
    // 3. Select existing check: see if they are already collaborators (returns [])
    // 4. Insert new collaborator record
    qb.mockResult([{ role: "owner" }])
      .mockResult([{ id: "user-b-collaborator", name: "Collab User", email: "collaborator@test.com" }])
      .mockResult([])
      .mockResult([{ role: "editor" }]);

    const collabResponse = await addCollabHandler(
      new Request("http://localhost:3000/api/documents/doc-uuid-123/collaborators", {
        method: "POST",
        body: JSON.stringify({
          email: "collaborator@test.com",
          role: "editor",
        }),
      }),
      {
        params: Promise.resolve({ id: "doc-uuid-123" }),
      }
    );

    expect(collabResponse.status).toBe(201);
    const collabData = await collabResponse.json();
    expect(collabData.collaborator.id).toBe("user-b-collaborator");
    expect(collabData.collaborator.role).toBe("editor");

    // ----------------------------------------------------
    // STEP 4: Token Generation for Sync (User A - Owner)
    // ----------------------------------------------------
    // Authenticate as User A (Owner)
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: "user-a-owner", email: "owner@test.com", name: "Owner User" },
      expires: "expiry",
    });

    // Queue DB response: Role check for the owner
    qb.mockResult([{ role: "owner" }]);

    const ownerSyncResponse = await getSyncTokenHandler(
      new Request("http://localhost:3000/api/documents/doc-uuid-123/sync", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "doc-uuid-123" }),
      }
    );

    expect(ownerSyncResponse.status).toBe(200);
    const ownerSyncData = await ownerSyncResponse.json();
    expect(ownerSyncData.token).toBeDefined();
    expect(typeof ownerSyncData.token).toBe("string");

    // ----------------------------------------------------
    // STEP 5: Token Generation for Sync (User B - Collaborator)
    // ----------------------------------------------------
    // Authenticate as User B (Collaborator)
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: "user-b-collaborator", email: "collaborator@test.com", name: "Collab User" },
      expires: "expiry",
    });

    // Queue DB response: Role check for User B
    qb.mockResult([{ role: "editor" }]);

    const collabSyncResponse = await getSyncTokenHandler(
      new Request("http://localhost:3000/api/documents/doc-uuid-123/sync", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "doc-uuid-123" }),
      }
    );

    expect(collabSyncResponse.status).toBe(200);
    const collabSyncData = await collabSyncResponse.json();
    expect(collabSyncData.token).toBeDefined();
    expect(typeof collabSyncData.token).toBe("string");
  });
});
