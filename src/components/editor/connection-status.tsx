"use client";

import { Wifi, WifiOff, Loader2, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SyncState } from "@/hooks/use-sync-engine";

interface ConnectionStatusProps {
  syncState: SyncState;
  pendingUpdates?: number;
  onReconnect?: () => void;
}

export function ConnectionStatus({ syncState, pendingUpdates = 0, onReconnect }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors", syncState === "connected" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", syncState === "offline" && "bg-amber-500/10 text-amber-600 dark:text-amber-400", syncState === "syncing" && "bg-blue-500/10 text-blue-600 dark:text-blue-400", syncState === "disconnected" && "bg-red-500/10 text-red-600 dark:text-red-400", syncState === "error" && "bg-red-500/10 text-red-600 dark:text-red-400")}>
        {syncState === "connected" && (
          <>
            <Wifi className="h-3 w-3" />
            <span className="hidden sm:inline">Saved</span>
          </>
        )}
        {syncState === "offline" && (
          <>
            <WifiOff className="h-3 w-3" />
            <span className="hidden sm:inline">Offline{pendingUpdates > 0 ? ` (${pendingUpdates} pending)` : ""}</span>
          </>
        )}
        {syncState === "syncing" && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="hidden sm:inline">Syncing</span>
          </>
        )}
        {syncState === "disconnected" && (
          <>
            <CloudOff className="h-3 w-3" />
            <span className="hidden sm:inline">Disconnected</span>
          </>
        )}
        {syncState === "error" && (
          <>
            <CloudOff className="h-3 w-3" />
            <span className="hidden sm:inline">Error</span>
          </>
        )}
      </div>

      {(syncState === "disconnected" || syncState === "error") && onReconnect && (
        <button onClick={onReconnect} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground" aria-label="Reconnect">
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
