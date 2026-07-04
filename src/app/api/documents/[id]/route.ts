import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, documentCollaborators } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { updateDocumentSchema } from "@/lib/validations/document";

async function getUserRole(documentId: string, userId: string) {
  const [collab] = await db
    .select({ role: documentCollaborators.role })
    .from(documentCollaborators)
    .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, userId)))
    .limit(1);
  return collab?.role || null;
}

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

  const [doc] = await db
    .select({
      id: documents.id,
      title: documents.title,
      ownerId: documents.ownerId,
      wordCount: documents.wordCount,
      isArchived: documents.isArchived,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found" } }, { status: 404 });
  }

  return NextResponse.json({ document: doc, role });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }, { status: 401 });
  }

  const { id } = await params;
  const role = await getUserRole(id, session.user.id);

  if (!role || role === "viewer") {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateDocumentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
  }

  const [updated] = await db
    .update(documents)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(documents.id, id))
    .returning({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
    });

  return NextResponse.json({ document: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }, { status: 401 });
  }

  const { id } = await params;
  const role = await getUserRole(id, session.user.id);

  if (role !== "owner") {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Only the owner can delete a document" } }, { status: 403 });
  }

  await db.delete(documents).where(eq(documents.id, id));

  return NextResponse.json({ success: true });
}
