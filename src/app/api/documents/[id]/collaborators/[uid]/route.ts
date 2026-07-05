import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documentCollaborators } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; uid: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const { id: documentId, uid: collaboratorUserId } = await params;

  try {
    // Check if the current user is the owner
    const [collab] = await db
      .select({ role: documentCollaborators.role })
      .from(documentCollaborators)
      .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, session.user.id)))
      .limit(1);

    const currentRole = collab?.role || null;
    if (currentRole !== "owner") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Only the owner can manage collaborators" } },
        { status: 403 }
      );
    }

    // Check if collaborator exists and what their role is
    const [targetCollab] = await db
      .select({ role: documentCollaborators.role })
      .from(documentCollaborators)
      .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, collaboratorUserId)))
      .limit(1);

    if (!targetCollab) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Collaborator not found" } },
        { status: 404 }
      );
    }

    // Do not allow removing the owner
    if (targetCollab.role === "owner") {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Cannot remove the document owner" } },
        { status: 400 }
      );
    }

    // Delete collaborator
    await db
      .delete(documentCollaborators)
      .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, collaboratorUserId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete collaborator:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete collaborator" } },
      { status: 500 }
    );
  }
}
