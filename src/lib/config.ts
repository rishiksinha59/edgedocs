export const siteConfig = {
  name: "EdgeDocs",
  description: "A local-first, collaborative document editor with offline synchronization, deterministic conflict resolution, and granular version control.",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
} as const;

export const editorConfig = {
  /** Maximum sync payload size in bytes (1MB) */
  maxSyncPayloadSize: 1_048_576,
  /** Maximum document size before compaction warning (5MB) */
  maxDocumentSize: 5_242_880,
  /** Debounce time for IndexedDB persistence (ms) */
  persistenceDebounce: 500,
  /** Auto-snapshot every N updates */
  autoSnapshotInterval: 50,
  /** WebSocket token expiry (seconds) */
  wsTokenExpiry: 300,
  /** Max AI requests per user per hour */
  aiRateLimit: 20,
  /** Sync retry config */
  sync: {
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  },
} as const;
