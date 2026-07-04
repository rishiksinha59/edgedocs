import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, documentCollaborators, documentVersions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

async function getUserRole(documentId: string, userId: string) {
  const [collab] = await db
    .select({ role: documentCollaborators.role })
    .from(documentCollaborators)
    .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, userId)))
    .limit(1);
  return collab?.role || null;
}

// GET /api/documents/[id]/versions/[versionId] — Get a specific version's content
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }, { status: 401 });
  }

  const { id, versionId } = await params;
  const role = await getUserRole(id, session.user.id);

  if (!role) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found" } }, { status: 404 });
  }

  const [version] = await db
    .select()
    .from(documentVersions)
    .where(and(eq(documentVersions.id, versionId), eq(documentVersions.documentId, id)))
    .limit(1);

  if (!version) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Version not found" } }, { status: 404 });
  }

  // Return the version with the Yjs state as base64 for transport
  return NextResponse.json({
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      title: version.title,
      description: version.description,
      createdBy: version.createdBy,
      wordCount: version.wordCount,
      createdAt: version.createdAt,
      // Encode binary Yjs state as base64 for JSON transport
      yjsSnapshot: version.yjsSnapshot ? Buffer.from(version.yjsSnapshot).toString("base64") : null,
    },
  });
}

// POST /api/documents/[id]/versions/[versionId] — Restore to this version
export async function POST(_request: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }, { status: 401 });
  }

  const { id, versionId } = await params;
  const role = await getUserRole(id, session.user.id);

  if (!role || role === "viewer" || role === "editor") {
    // Only owners can restore versions
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Only document owners can restore versions" } }, { status: 403 });
  }

  // Get the version to restore
  const [version] = await db
    .select({ yjsSnapshot: documentVersions.yjsSnapshot, wordCount: documentVersions.wordCount })
    .from(documentVersions)
    .where(and(eq(documentVersions.id, versionId), eq(documentVersions.documentId, id)))
    .limit(1);

  if (!version || !version.yjsSnapshot) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Version not found" } }, { status: 404 });
  }

  // Update the document's Yjs state to the snapshot
  await db
    .update(documents)
    .set({
      yjsState: version.yjsSnapshot,
      wordCount: version.wordCount,
      updatedAt: new Date(),
      lastEditedBy: session.user.id,
    })
    .where(eq(documents.id, id));

  return NextResponse.json({ success: true, message: "Document restored to selected version" });
}
