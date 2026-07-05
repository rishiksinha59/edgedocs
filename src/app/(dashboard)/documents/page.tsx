"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, MoreHorizontal, Trash2, Loader2, Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InputDialog } from "@/components/ui/input-dialog";

interface Document {
  id: string;
  title: string;
  ownerId: string;
  wordCount: number | null;
  isArchived: boolean | null;
  createdAt: string;
  updatedAt: string;
}

function DocumentCard({
  doc,
  onDeleteClick,
  onRenameClick,
}: {
  doc: Document;
  onDeleteClick: (id: string) => void;
  onRenameClick: (id: string, currentTitle: string) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    onRenameClick(doc.id, doc.title);
  };

  const handleOpenNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    window.open(`/editor/${doc.id}`, "_blank");
  };

  return (
    <div className="group relative flex cursor-pointer flex-col rounded-xl border bg-card p-5 transition-all hover:border-primary/20 hover:shadow-md" onClick={() => router.push(`/editor/${doc.id}`)}>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="relative" ref={menuRef}>
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
            <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleOpenNewTab}
                className="flex cursor-pointer w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /> Open in new tab
              </button>
              <button
                onClick={handleRename}
                className="flex cursor-pointer w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-foreground"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Rename
              </button>
              <button
                onClick={() => {
                  onDeleteClick(doc.id);
                  setMenuOpen(false);
                }}
                className="flex cursor-pointer w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent border-t border-border/50 mt-1 pt-1.5"
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

  // Modal dialog states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingDoc, setRenamingDoc] = useState<{ id: string; title: string } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

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

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteConfirmOpen(true);
  };

  const handleRenameClick = (id: string, currentTitle: string) => {
    setRenamingDoc({ id, title: currentTitle });
    setRenameDialogOpen(true);
  };

  async function handleDeleteConfirm() {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/documents/${deletingId}`, { method: "DELETE" });
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== deletingId));
        setDeleteConfirmOpen(false);
        setDeletingId(null);
      } else {
        alert("Failed to delete document");
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
      alert("Failed to delete document");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRenameConfirm(newTitle: string) {
    if (!renamingDoc) return;
    setIsRenaming(true);
    try {
      const res = await fetch(`/api/documents/${renamingDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setDocs((prev) =>
          prev.map((d) => (d.id === renamingDoc.id ? { ...d, title: newTitle, updatedAt: new Date().toISOString() } : d))
        );
        setRenameDialogOpen(false);
        setRenamingDoc(null);
      } else {
        alert("Failed to rename document");
      }
    } catch (err) {
      console.error("Failed to rename document:", err);
      alert("Failed to rename document");
    } finally {
      setIsRenaming(false);
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
            <DocumentCard key={doc.id} doc={doc} onDeleteClick={handleDeleteClick} onRenameClick={handleRenameClick} />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeletingId(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete document"
        description="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={isDeleting}
      />

      {/* Rename Input Dialog */}
      <InputDialog
        isOpen={renameDialogOpen}
        onClose={() => {
          setRenameDialogOpen(false);
          setRenamingDoc(null);
        }}
        onSubmit={handleRenameConfirm}
        title="Rename document"
        description="Enter a new title for this document."
        defaultValue={renamingDoc?.title || ""}
        placeholder="Document title"
        submitText="Rename"
        isLoading={isRenaming}
      />
    </div>
  );
}
