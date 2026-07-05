"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Plus, RotateCcw, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Version {
  id: string;
  versionNumber: number;
  title: string | null;
  description: string | null;
  createdBy: string;
  wordCount: number | null;
  createdAt: string;
}

interface VersionPanelProps {
  documentId: string;
  userRole: string;
  isOpen: boolean;
  onClose: () => void;
  onRestore: (versionId: string) => Promise<void>;
  onPreview: (versionId: string) => void;
}

export function VersionPanel({ documentId, userRole, isOpen, onClose, onRestore, onPreview }: VersionPanelProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore confirmation states
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const canCreate = userRole === "owner" || userRole === "editor";
  const canRestore = userRole === "owner";

  const fetchVersions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`);
      if (!res.ok) throw new Error("Failed to fetch versions");
      const data = await res.json();
      setVersions(data.versions);
    } catch (err) {
      setError("Failed to load version history");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    }
  }, [isOpen, fetchVersions]);

  const createVersion = async () => {
    setIsCreating(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to create version");
      }
      await fetchVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create version");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestoreClick = (versionId: string) => {
    setPendingRestoreId(versionId);
    setRestoreConfirmOpen(true);
  };

  const handleRestoreConfirm = async () => {
    if (!pendingRestoreId) return;
    setIsRestoring(true);
    try {
      await onRestore(pendingRestoreId);
      setRestoreConfirmOpen(false);
      setPendingRestoreId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore version");
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs md:hidden"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-xs flex-col border-l bg-background shadow-xl md:relative md:w-80 md:shadow-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Version History</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 cursor-pointer">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Create Version Button */}
      {canCreate && (
        <div className="border-b px-4 py-3">
          <Button onClick={createVersion} disabled={isCreating} size="sm" className="w-full cursor-pointer">
            <Plus className="mr-2 h-3.5 w-3.5" />
            {isCreating ? "Saving..." : "Save Version"}
          </Button>
        </div>
      )}

      {/* Version List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        )}

        {error && <div className="px-4 py-3 text-xs text-red-600 dark:text-red-400">{error}</div>}

        {!isLoading && versions.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No versions yet</p>
            <p className="text-xs text-muted-foreground/70">Save a version to create a checkpoint you can restore later.</p>
          </div>
        )}

        {versions.map((version) => (
          <div key={version.id} className="group border-b px-4 py-3 transition-colors hover:bg-muted/50">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{version.title || `Version ${version.versionNumber}`}</p>
                {version.description && <p className="mt-0.5 text-xs text-muted-foreground truncate">{version.description}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(version.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {version.wordCount != null && <span className="ml-2">{version.wordCount} words</span>}
                </p>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canRestore && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => handleRestoreClick(version.id)} title="Restore this version">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        isOpen={restoreConfirmOpen}
        onClose={() => {
          setRestoreConfirmOpen(false);
          setPendingRestoreId(null);
        }}
        onConfirm={handleRestoreConfirm}
        title="Restore version"
        description="Are you sure you want to restore this version? This will replace the current document content."
        confirmText="Restore"
        isLoading={isRestoring}
      />
    </div>
    </>
  );
}
