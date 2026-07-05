"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
import { useSyncEngine } from "@/hooks/use-sync-engine";
import { EditorToolbar } from "./editor-toolbar";
import { ConnectionStatus } from "./connection-status";
import { OfflineBanner } from "./offline-banner";
import { VersionPanel } from "./version-panel";
import { AIAssistant } from "./ai-assistant";
import { ArrowLeft, History, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditorRootProps {
  documentId: string;
  initialTitle: string;
  userRole: string;
  userId: string;
  userName: string;
}

export function EditorRoot({ documentId, initialTitle, userRole, userId, userName }: EditorRootProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [isSaving, setIsSaving] = useState(false);
  const [isVersionPanelOpen, setIsVersionPanelOpen] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [ydoc] = useState(() => new Y.Doc());
  const isReadOnly = userRole === "viewer";

  // Offline Sync Engine — handles IndexedDB + WebSocket + reconnection
  const { syncState, pendingUpdates, forceReconnect } = useSyncEngine({ documentId, ydoc });

  // Configure TipTap editor with Yjs collaboration extension
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: false, // Yjs handles undo/redo
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
        emptyEditorClass: "is-editor-empty",
      }),
      Collaboration.configure({
        document: ydoc,
      }),
    ],
    editable: !isReadOnly,
    editorProps: {
      attributes: {
        class: "prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-12rem)] px-4 py-6 md:px-0",
      },
    },
    immediatelyRender: false,
  });

  // Title update with debounce
  const saveTitle = useCallback(
    async (newTitle: string) => {
      if (isReadOnly) return;
      setIsSaving(true);
      try {
        await fetch(`/api/documents/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle || "Untitled" }),
        });
      } catch (err) {
        console.error("Failed to save title:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [documentId, isReadOnly],
  );

  // Debounced title save
  useEffect(() => {
    if (title === initialTitle) return;
    const timer = setTimeout(() => saveTitle(title), 800);
    return () => clearTimeout(timer);
  }, [title, saveTitle, initialTitle]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Offline Banner */}
      <OfflineBanner />

      {/* Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={() => router.push("/documents")} aria-label="Back to documents">
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground" placeholder="Untitled" disabled={isReadOnly} aria-label="Document title" />

        <ConnectionStatus syncState={syncState} pendingUpdates={pendingUpdates} onReconnect={forceReconnect} />

        <Button variant="ghost" size="icon" onClick={() => setIsVersionPanelOpen((v) => !v)} aria-label="Version history" title="Version history">
          <History className="h-4 w-4" />
        </Button>

        {!isReadOnly && (
          <Button variant="ghost" size="icon" onClick={() => setIsAIPanelOpen((v) => !v)} aria-label="AI assistant" title="AI assistant">
            <Sparkles className="h-4 w-4" />
          </Button>
        )}

        {isReadOnly && <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">View only</span>}
      </header>

      {/* Toolbar */}
      {!isReadOnly && editor && <EditorToolbar editor={editor} />}

      {/* Main content area with optional version panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto">
          <EditorContent editor={editor} />
        </div>

        {/* Version History Panel */}
        <VersionPanel
          documentId={documentId}
          userRole={userRole}
          isOpen={isVersionPanelOpen}
          onClose={() => setIsVersionPanelOpen(false)}
          onRestore={async (versionId) => {
            // Client-side restore: fetch snapshot, apply as new edit (CRDT-correct)
            try {
              const res = await fetch(`/api/documents/${documentId}/versions/${versionId}`);
              if (!res.ok) throw new Error("Failed to fetch version");
              const { version } = await res.json();
              if (!version.yjsSnapshot) throw new Error("Version has no content");

              // Decode the base64 Yjs state into a temp doc
              const snapshotBytes = Uint8Array.from(atob(version.yjsSnapshot), (c) => c.charCodeAt(0));
              const tempDoc = new Y.Doc();
              Y.applyUpdate(tempDoc, snapshotBytes);

              // Get content from old snapshot
              const oldFragment = tempDoc.getXmlFragment("default");

              // Replace current document content with the old version's content
              const currentFragment = ydoc.getXmlFragment("default");
              ydoc.transact(() => {
                // Delete all current content
                currentFragment.delete(0, currentFragment.length);
                // Clone nodes from old doc into current doc
                for (let i = 0; i < oldFragment.length; i++) {
                  const node = oldFragment.get(i);
                  currentFragment.insert(i, [node.clone()]);
                }
              });

              tempDoc.destroy();
            } catch (err) {
              console.error("Failed to restore version:", err);
              alert("Failed to restore version. Please try again.");
            }
          }}
          onPreview={() => {}}
        />

        {/* AI Assistant Panel */}
        <AIAssistant editor={editor} isOpen={isAIPanelOpen} onClose={() => setIsAIPanelOpen(false)} />
      </div>
    </div>
  );
}
