import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, documentCollaborators } from "@/lib/db/schema";
import { eq, or, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDocumentSchema } from "@/lib/validations/document";
import { rateLimit, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }, { status: 401 });
  }

  const userId = session.user.id;

  // Get documents user owns or collaborates on
  const ownedDocs = await db
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
    .where(eq(documents.ownerId, userId))
    .orderBy(desc(documents.updatedAt));

  const collabDocs = await db
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
    .innerJoin(documentCollaborators, eq(documents.id, documentCollaborators.documentId))
    .where(eq(documentCollaborators.userId, userId))
    .orderBy(desc(documents.updatedAt));

  // Merge and dedupe
  const allDocs = [...ownedDocs, ...collabDocs];
  const uniqueDocs = Array.from(new Map(allDocs.map((d) => [d.id, d])).values());

  return NextResponse.json({ documents: uniqueDocs });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }, { status: 401 });
  }

  // Rate limit document creation
  const rl = rateLimit(`create:${session.user.id}`, RATE_LIMITS.create);
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  const body = await request.json();
  const parsed = createDocumentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } }, { status: 400 });
  }

  const [doc] = await db
    .insert(documents)
    .values({
      title: parsed.data.title,
      ownerId: session.user.id,
    })
    .returning({
      id: documents.id,
      title: documents.title,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    });

  // Also add owner as a collaborator with 'owner' role
  await db.insert(documentCollaborators).values({
    documentId: doc.id,
    userId: session.user.id,
    role: "owner",
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}
