/**
 * Unit tests for the collaborator role update API endpoint.
 * Mocks the database connection and auth session to verify role updates are secure.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "@/app/api/documents/[id]/collaborators/[uid]/route";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock drizzle db
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

describe("PATCH /api/documents/[id]/collaborators/[uid]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if user is not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await PATCH(new Request("http://localhost:3000", { method: "PATCH" }), {
      params: Promise.resolve({ id: "doc-123", uid: "user-456" }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 if authenticated user is not the document owner", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-789", name: "Editor User" },
      expires: "expiry",
    });

    // Mock db.select().from().where().limit() returning "editor" role
    const mockLimit = vi.fn().mockResolvedValue([{ role: "editor" }]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

    const res = await PATCH(new Request("http://localhost:3000", { method: "PATCH" }), {
      params: Promise.resolve({ id: "doc-123", uid: "user-456" }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 if trying to change the owner's role", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "owner-id", name: "Owner User" },
      expires: "expiry",
    });

    // Requester role check is "owner"
    // Target collaborator role check is "owner"
    const mockLimit = vi.fn()
      .mockResolvedValueOnce([{ role: "owner" }]) // first call: requester check
      .mockResolvedValueOnce([{ role: "owner" }]); // second call: target check
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

    const res = await PATCH(
      new Request("http://localhost:3000", {
        method: "PATCH",
        body: JSON.stringify({ role: "editor" }),
      }),
      {
        params: Promise.resolve({ id: "doc-123", uid: "owner-id" }),
      }
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("BAD_REQUEST");
  });

  it("returns 400 if the new role is invalid", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "owner-id", name: "Owner User" },
      expires: "expiry",
    });

    const mockLimit = vi.fn()
      .mockResolvedValueOnce([{ role: "owner" }])
      .mockResolvedValueOnce([{ role: "viewer" }]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

    const res = await PATCH(
      new Request("http://localhost:3000", {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }), // invalid role
      }),
      {
        params: Promise.resolve({ id: "doc-123", uid: "user-456" }),
      }
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("BAD_REQUEST");
  });

  it("updates and returns the collaborator on success", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "owner-id", name: "Owner User" },
      expires: "expiry",
    });

    const mockLimit = vi.fn()
      .mockResolvedValueOnce([{ role: "owner" }])
      .mockResolvedValueOnce([{ role: "viewer" }]);
    const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFromSelect = vi.fn().mockReturnValue({ where: mockWhereSelect });
    vi.mocked(db.select).mockReturnValue({ from: mockFromSelect } as any);

    // Mock db.update().set().where().returning()
    const mockReturning = vi.fn().mockResolvedValue([{ userId: "user-456", role: "editor" }]);
    const mockWhereUpdate = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate });
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

    const res = await PATCH(
      new Request("http://localhost:3000", {
        method: "PATCH",
        body: JSON.stringify({ role: "editor" }),
      }),
      {
        params: Promise.resolve({ id: "doc-123", uid: "user-456" }),
      }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.collaborator.role).toBe("editor");
  });
});
