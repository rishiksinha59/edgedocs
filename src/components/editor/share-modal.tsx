"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { X, UserPlus, Trash2, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Collaborator {
  id: string;
  name: string | null;
  email: string;
  role: "owner" | "editor" | "viewer";
  createdAt: string;
}

interface ShareModalProps {
  documentId: string;
  userRole: string; // "owner" | "editor" | "viewer"
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ documentId, userRole, isOpen, onClose }: ShareModalProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Revoke confirmation states
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [pendingRemoveUser, setPendingRemoveUser] = useState<{ id: string; email: string } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const isOwner = userRole === "owner";

  const fetchCollaborators = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/collaborators`);
      if (!res.ok) {
        throw new Error("Failed to load collaborators");
      }
      const data = await res.json();
      setCollaborators(data.collaborators);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch collaborators. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen) {
      fetchCollaborators();
      setError(null);
      setSuccess(null);
      setEmail("");
    }
  }, [isOpen, fetchCollaborators]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Close on click outside
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsInviting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to add collaborator");
      }

      setSuccess(`Successfully invited ${email}!`);
      setEmail("");
      // Add the new collaborator directly to state to avoid refetching
      setCollaborators((prev) => [...prev, data.collaborator]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite collaborator");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveClick = (userId: string, userEmail: string) => {
    setPendingRemoveUser({ id: userId, email: userEmail });
    setRemoveConfirmOpen(true);
  };

  const handleRemoveConfirm = async () => {
    if (!pendingRemoveUser) return;

    setIsRemoving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/collaborators/${pendingRemoveUser.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to remove collaborator");
      }

      setSuccess(`Removed access for ${pendingRemoveUser.email}.`);
      setCollaborators((prev) => prev.filter((c) => c.id !== pendingRemoveUser.id));
      setRemoveConfirmOpen(false);
      setPendingRemoveUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove collaborator");
    } finally {
      setIsRemoving(false);
    }
  };

  function getInitials(name: string | null, email: string) {
    const text = name || email;
    return text
      .split(/[@\s]/)[0]
      .slice(0, 2)
      .toUpperCase();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity"
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md scale-100 rounded-xl border bg-background p-6 shadow-lg transition-transform duration-200 animate-in fade-in-0 zoom-in-95"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute right-4 top-4 h-7 w-7 rounded-md"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Title */}
        <div className="mb-5 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 id="share-modal-title" className="text-lg font-semibold tracking-tight">
            Share document
          </h2>
        </div>

        {/* Invite Form (only visible/enabled for owner) */}
        {isOwner ? (
          <form onSubmit={handleInvite} className="mb-6 flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter email address..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isInviting}
                className="flex-1"
                required
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
                disabled={isInviting}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <Button type="submit" disabled={isInviting} className="w-full">
              {isInviting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Inviting...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Invite
                </>
              )}
            </Button>
          </form>
        ) : (
          <p className="mb-6 text-sm text-muted-foreground">
            Only the document owner can manage collaborators.
          </p>
        )}

        {/* Notifications */}
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-md bg-green-500/10 px-3 py-2 text-xs font-medium text-green-600 dark:text-green-400">
            {success}
          </div>
        )}

        {/* Collaborators List */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">People with access</h3>
          
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto pr-1 flex flex-col gap-3">
              {collaborators.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                      {getInitials(c.name, c.email)}
                    </div>
                    {/* Details */}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium leading-none">
                        {c.name || "Pending User"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground mt-0.5">
                        {c.email}
                      </p>
                    </div>
                  </div>

                  {/* Actions (Role Badge / Delete button) */}
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
                        c.role === "owner" && "bg-primary/10 text-primary",
                        c.role === "editor" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                        c.role === "viewer" && "bg-gray-500/10 text-gray-500"
                      )}
                    >
                      {c.role}
                    </span>

                    {/* Revoke button (only visible to owner, and only for non-owner collaborators) */}
                    {isOwner && c.role !== "owner" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveClick(c.id, c.email)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title={`Remove ${c.email}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Collaborator Revocation Confirmation Dialog */}
      <ConfirmDialog
        isOpen={removeConfirmOpen}
        onClose={() => {
          setRemoveConfirmOpen(false);
          setPendingRemoveUser(null);
        }}
        onConfirm={handleRemoveConfirm}
        title="Revoke access"
        description={`Are you sure you want to revoke document access for ${pendingRemoveUser?.email}?`}
        confirmText="Revoke"
        variant="destructive"
        isLoading={isRemoving}
      />
    </div>
  );
}
