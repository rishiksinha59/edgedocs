import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, documentCollaborators } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { addCollaboratorSchema } from "@/lib/validations/document";

async function getUserRole(documentId: string, userId: string) {
  const [collab] = await db
    .select({ role: documentCollaborators.role })
    .from(documentCollaborators)
    .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, userId)))
    .limit(1);
  return collab?.role || null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const { id: documentId } = await params;
  const currentRole = await getUserRole(documentId, session.user.id);

  if (!currentRole) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Document not found or access denied" } },
      { status: 404 }
    );
  }

  try {
    const list = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: documentCollaborators.role,
        createdAt: documentCollaborators.createdAt,
      })
      .from(documentCollaborators)
      .innerJoin(users, eq(documentCollaborators.userId, users.id))
      .where(eq(documentCollaborators.documentId, documentId))
      .orderBy(documentCollaborators.createdAt);

    return NextResponse.json({ collaborators: list });
  } catch (err) {
    console.error("Failed to fetch collaborators:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch collaborators" } },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const { id: documentId } = await params;
  const currentRole = await getUserRole(documentId, session.user.id);

  if (currentRole !== "owner") {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Only the owner can manage collaborators" } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = addCollaboratorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;

    // Find invitee by email
    const [invitee] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!invitee) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User with this email address does not exist." } },
        { status: 404 }
      );
    }

    // Check if invitee is already a collaborator
    const [existingCollab] = await db
      .select()
      .from(documentCollaborators)
      .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, invitee.id)))
      .limit(1);

    if (existingCollab) {
      return NextResponse.json(
        { error: { code: "ALREADY_EXISTS", message: "User is already a collaborator." } },
        { status: 400 }
      );
    }

    // Insert collaborator record
    const [newCollab] = await db
      .insert(documentCollaborators)
      .values({
        documentId,
        userId: invitee.id,
        role,
        invitedBy: session.user.id,
      })
      .returning();

    return NextResponse.json(
      {
        collaborator: {
          id: invitee.id,
          name: invitee.name,
          email: invitee.email,
          role: newCollab.role,
          createdAt: newCollab.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Failed to add collaborator:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to add collaborator" } },
      { status: 500 }
    );
  }
}
