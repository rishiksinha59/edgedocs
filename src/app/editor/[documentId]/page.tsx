import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, documentCollaborators } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { EditorRoot } from "@/components/editor/editor-root";

interface EditorPageProps {
  params: Promise<{ documentId: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { documentId } = await params;

  // Verify user has access to this document
  const [collab] = await db
    .select({ role: documentCollaborators.role })
    .from(documentCollaborators)
    .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, session.user.id)))
    .limit(1);

  if (!collab) {
    redirect("/documents");
  }

  // Fetch document metadata
  const [doc] = await db
    .select({
      id: documents.id,
      title: documents.title,
      ownerId: documents.ownerId,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    redirect("/documents");
  }

  return <EditorRoot documentId={doc.id} initialTitle={doc.title} userRole={collab.role} userId={session.user.id} userName={session.user.name || "Anonymous"} />;
}
