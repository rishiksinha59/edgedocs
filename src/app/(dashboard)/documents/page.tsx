"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, MoreHorizontal, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "@/lib/format";

interface Document {
  id: string;
  title: string;
  ownerId: string;
  wordCount: number | null;
  isArchived: boolean | null;
  createdAt: string;
  updatedAt: string;
}

function DocumentCard({ doc, onDelete }: { doc: Document; onDelete: (id: string) => void }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group relative flex cursor-pointer flex-col rounded-xl border bg-card p-5 transition-all hover:border-primary/20 hover:shadow-md" onClick={() => router.push(`/editor/${doc.id}`)}>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-opacity hover:bg-secondary"
            aria-label="Document options"
          >
            <MoreHorizontal className="h-4 w-4 cursor-pointer" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-md border bg-popover p-1 shadow-md" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => {
                  onDelete(doc.id);
                  setMenuOpen(false);
                }}
                className="flex cursor-pointer w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <h3 className="mb-1 truncate text-sm font-medium">{doc.title}</h3>
      <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(doc.updatedAt))}</p>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="mb-1 text-lg font-semibold">No documents yet</h2>
      <p className="mb-6 text-sm text-muted-foreground">Create your first document to get started</p>
      <Button onClick={onCreate}>
        <Plus className="h-4 w-4" /> New document
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col rounded-xl border bg-card p-5">
          <div className="mb-3 h-9 w-9 animate-pulse rounded-lg bg-secondary" />
          <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-secondary" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
        </div>
      ))}
    </div>
  );
}

export default function DocumentsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function handleCreate() {
    setIsCreating(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled" }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/editor/${data.document.id}`);
      }
    } catch (err) {
      console.error("Failed to create document:", err);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">Create and manage your collaborative documents</p>
        </div>
        <Button onClick={handleCreate} disabled={isCreating} className="cursor-pointer">
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New document
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : docs.length === 0 ? (
        <EmptyState onCreate={handleCreate} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {docs.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
