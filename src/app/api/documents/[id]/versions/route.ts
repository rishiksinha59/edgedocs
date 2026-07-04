import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, documentCollaborators, documentVersions } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

async function getUserRole(documentId: string, userId: string) {
  const [collab] = await db
    .select({ role: documentCollaborators.role })
    .from(documentCollaborators)
    .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, userId)))
    .limit(1);
  return collab?.role || null;
}

// GET /api/documents/[id]/versions — List all versions
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }, { status: 401 });
  }

  const { id } = await params;
  const role = await getUserRole(id, session.user.id);

  if (!role) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found" } }, { status: 404 });
  }

  const versions = await db
    .select({
      id: documentVersions.id,
      versionNumber: documentVersions.versionNumber,
      title: documentVersions.title,
      description: documentVersions.description,
      createdBy: documentVersions.createdBy,
      wordCount: documentVersions.wordCount,
      createdAt: documentVersions.createdAt,
    })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, id))
    .orderBy(desc(documentVersions.versionNumber));

  return NextResponse.json({ versions });
}

// POST /api/documents/[id]/versions — Create a new version snapshot
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }, { status: 401 });
  }

  const { id } = await params;
  const role = await getUserRole(id, session.user.id);

  if (!role || role === "viewer") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  // Parse optional title/description from body
  let title: string | null = null;
  let description: string | null = null;
  try {
    const body = await request.json();
    title = body.title || null;
    description = body.description || null;
  } catch {
    // Body is optional
  }

  // Get the current document Yjs state
  const [doc] = await db.select({ yjsState: documents.yjsState, wordCount: documents.wordCount }).from(documents).where(eq(documents.id, id)).limit(1);

  if (!doc) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found" } }, { status: 404 });
  }

  if (!doc.yjsState) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Document has no content to snapshot" } }, { status: 400 });
  }

  // Get the next version number
  const [latest] = await db
    .select({ maxVersion: sql<number>`COALESCE(MAX(${documentVersions.versionNumber}), 0)` })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, id));

  const nextVersion = (latest?.maxVersion || 0) + 1;

  // Create the version snapshot
  const [version] = await db
    .insert(documentVersions)
    .values({
      documentId: id,
      yjsSnapshot: doc.yjsState,
      title: title || `Version ${nextVersion}`,
      description,
      createdBy: session.user.id,
      wordCount: doc.wordCount,
      versionNumber: nextVersion,
    })
    .returning({
      id: documentVersions.id,
      versionNumber: documentVersions.versionNumber,
      title: documentVersions.title,
      createdAt: documentVersions.createdAt,
    });

  return NextResponse.json({ version }, { status: 201 });
}
