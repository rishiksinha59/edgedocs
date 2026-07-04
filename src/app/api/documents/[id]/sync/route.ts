import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documentCollaborators } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.COLLABORATION_JWT_SECRET || "");

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }, { status: 401 });
  }

  const { id: documentId } = await params;

  // Verify user has access
  const [collab] = await db
    .select({ role: documentCollaborators.role })
    .from(documentCollaborators)
    .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, session.user.id)))
    .limit(1);

  if (!collab) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found" } }, { status: 404 });
  }

  // Generate short-lived JWT token for WebSocket authentication
  const token = await new SignJWT({
    userId: session.user.id,
    documentId,
    role: collab.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(JWT_SECRET);

  return NextResponse.json({ token });
}
