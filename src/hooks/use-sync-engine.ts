"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useOnlineStatus } from "./use-online-status";

export type SyncState =
  | "connected" // WebSocket connected and synced
  | "syncing" // Attempting to connect/sync
  | "offline" // Browser is offline, changes queued locally
  | "disconnected" // Browser online but WS disconnected (server down?)
  | "error"; // Unrecoverable error

export interface SyncEngineState {
  syncState: SyncState;
  hasUnsyncedChanges: boolean;
  lastSyncedAt: Date | null;
  retryCount: number;
  pendingUpdates: number;
}

interface UseSyncEngineOptions {
  documentId: string;
  ydoc: Y.Doc;
  enabled?: boolean;
}

export function useSyncEngine({ documentId, ydoc, enabled = true }: UseSyncEngineOptions) {
  const isOnline = useOnlineStatus();
  const [syncState, setSyncState] = useState<SyncState>("syncing");
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  const hocuspocusRef = useRef<HocuspocusProvider | null>(null);
  const indexeddbRef = useRef<IndexeddbPersistence | null>(null);
  const pendingCountRef = useRef(0);

  // Track local updates that haven't been synced
  useEffect(() => {
    const handler = () => {
      if (!hocuspocusRef.current?.isSynced) {
        pendingCountRef.current += 1;
        setPendingUpdates(pendingCountRef.current);
        setHasUnsyncedChanges(true);
      }
    };
    ydoc.on("update", handler);
    return () => {
      ydoc.off("update", handler);
    };
  }, [ydoc]);



  // Initialize providers
  useEffect(() => {
    if (!enabled) return;

    // IndexedDB persistence (always on)
    const indexeddb = new IndexeddbPersistence(`edgedocs-${documentId}`, ydoc);
    indexeddbRef.current = indexeddb;

    indexeddb.on("synced", () => {
      // IndexedDB loaded — if no WS, we're in local mode
      if (!hocuspocusRef.current?.isSynced && !isOnline) {
        setSyncState("offline");
      }
    });

    // Hocuspocus WebSocket
    const wsUrl = process.env.NEXT_PUBLIC_COLLABORATION_URL;
    if (wsUrl) {
      const hocuspocus = new HocuspocusProvider({
        url: wsUrl,
        name: documentId,
        document: ydoc,
        token: async () => {
          const res = await fetch(`/api/documents/${documentId}/sync`, {
            method: "POST",
          });
          if (!res.ok) throw new Error("Failed to get sync token");
          const { token } = await res.json();
          return token;
        },
        onStatus({ status }) {
          if (status === "connected") {
            setSyncState("connected");
            setLastSyncedAt(new Date());
            setRetryCount(0);
            // Clear pending count on successful sync
            pendingCountRef.current = 0;
            setPendingUpdates(0);
            setHasUnsyncedChanges(false);
          } else if (status === "connecting") {
            setSyncState("syncing");
            setRetryCount((prev) => prev + 1);
          } else if (status === "disconnected") {
            setSyncState(isOnline ? "disconnected" : "offline");
          }
        },
        onSynced({ state }) {
          if (state) {
            setLastSyncedAt(new Date());
            pendingCountRef.current = 0;
            setPendingUpdates(0);
            setHasUnsyncedChanges(false);
          }
        },
      });

      hocuspocusRef.current = hocuspocus;
    }

    return () => {
      if (hocuspocusRef.current) {
        hocuspocusRef.current.destroy();
        hocuspocusRef.current = null;
      }
      if (indexeddbRef.current) {
        indexeddbRef.current.destroy();
        indexeddbRef.current = null;
      }
    };
  }, [documentId, ydoc, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Connect/disconnect based on browser online status
  useEffect(() => {
    const provider = hocuspocusRef.current;
    if (!provider) return;

    if (!isOnline) {
      provider.disconnect();
      setSyncState("offline");
    } else {
      setSyncState("syncing");
      provider.connect();
    }
  }, [isOnline]);

  // Manual reconnect
  const forceReconnect = useCallback(() => {
    if (hocuspocusRef.current) {
      hocuspocusRef.current.disconnect();
      hocuspocusRef.current.connect();
      setSyncState("syncing");
    }
  }, []);

  return {
    syncState,
    hasUnsyncedChanges,
    lastSyncedAt,
    retryCount,
    pendingUpdates,
    forceReconnect,
    provider: hocuspocusRef,
  };
}
