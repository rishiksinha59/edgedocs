"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

/**
 * Banner that appears at the top of the editor when the user goes offline.
 * Provides reassurance that edits are saved locally and will sync when back online.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
      <WifiOff className="h-3.5 w-3.5" />
      <span>You&apos;re offline. Your changes are saved locally and will sync when you reconnect.</span>
    </div>
  );
}
