# EdgeDocs — Technical Architecture Document

## Executive Summary

EdgeDocs is a local-first, collaborative document editor that provides seamless offline editing, deterministic conflict resolution via CRDTs, granular version history, and real-time multi-user collaboration. It is designed as a production-grade SaaS application with security, scalability, and performance at its core.

---

## Table of Contents

1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [Technology Stack & Justification](#2-technology-stack--justification)
3. [Folder & Project Structure](#3-folder--project-structure)
4. [Database Schema & Relationships](#4-database-schema--relationships)
5. [Authentication & Authorization Architecture](#5-authentication--authorization-architecture)
6. [Local-First Architecture](#6-local-first-architecture)
7. [Offline Synchronization Engine](#7-offline-synchronization-engine)
8. [Deterministic Conflict Resolution Strategy](#8-deterministic-conflict-resolution-strategy)
9. [Version History Implementation](#9-version-history-implementation)
10. [Real-Time Collaboration Architecture](#10-real-time-collaboration-architecture)
11. [API Design](#11-api-design)
12. [Security Architecture](#12-security-architecture)
13. [Deployment Architecture](#13-deployment-architecture)
14. [Testing Strategy](#14-testing-strategy)
15. [Performance Optimization Strategy](#15-performance-optimization-strategy)
16. [AI Features Architecture](#16-ai-features-architecture)
17. [Implementation Roadmap](#17-implementation-roadmap)

---

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   TipTap     │  │  Yjs CRDT    │  │   Sync Engine            │  │
│  │   Editor     │──│  Document    │──│   (Queue + Retry +       │  │
│  │   (UI)       │  │  (In-Memory) │  │    Conflict Detection)   │  │
│  └──────────────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│                           │                        │                 │
│                    ┌──────▼───────┐         ┌──────▼───────┐        │
│                    │  IndexedDB   │         │  WebSocket   │        │
│                    │  (y-indexeddb)│         │  Client      │        │
│                    │  Persistence │         │  (y-websocket)│        │
│                    └──────────────┘         └──────┬───────┘        │
│                                                    │                 │
└────────────────────────────────────────────────────┼─────────────────┘
                                                     │
                              ┌───────────────────────┘
                              │ WebSocket (wss://)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    COLLABORATION SERVER                              │
│                    (Hocuspocus on Railway/Fly.io)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  WebSocket   │  │  Yjs Server  │  │   Auth Middleware        │  │
│  │  Server      │──│  Document    │──│   (JWT Validation +      │  │
│  │  (ws)        │  │  Merge       │  │    Role Enforcement)     │  │
│  └──────────────┘  └──────┬───────┘  └──────────────────────────┘  │
│                           │                                         │
│                    ┌──────▼───────┐  ┌──────────────────────────┐   │
│                    │  Payload     │  │   Rate Limiter           │   │
│                    │  Validator   │  │   (per-user, per-doc)    │   │
│                    │  (Size+Schema)│  └──────────────────────────┘   │
│                    └──────┬───────┘                                  │
│                           │                                         │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS APPLICATION SERVER                        │
│                    (Vercel)                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  App Router  │  │  API Routes  │  │   Server Actions         │  │
│  │  (SSR/SSG)   │  │  (REST)      │  │   (Mutations)            │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Auth.js     │  │  AI SDK      │  │   Middleware             │  │
│  │  (NextAuth)  │  │  (Vercel)    │  │   (Rate Limit + RBAC)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL (Neon Serverless)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Users       │  │  Documents   │  │   Versions/Snapshots     │  │
│  │  Sessions    │  │  Permissions │  │   Sync Metadata          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                     │
│  Row Level Security (RLS) enabled for tenant isolation              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow Summary

1. **Editing**: User types → TipTap → Yjs Document (CRDT) → IndexedDB (persist) + WebSocket (broadcast)
2. **Offline**: User types → TipTap → Yjs Document → IndexedDB only (queued for sync)
3. **Reconnection**: Sync Engine detects connectivity → Pushes queued Yjs updates via WebSocket → Server merges (CRDT guarantees convergence) → Broadcasts to other clients
4. **Version Capture**: User triggers snapshot → Yjs snapshot created → Stored in PostgreSQL with metadata
5. **Restore**: User selects version → Diff computed → New Yjs update applied (non-destructive)

---

## 2. Technology Stack & Justification

### Core Framework

| Technology                   | Role                 | Why Selected                                                                            | Alternatives Considered                         |
| ---------------------------- | -------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Next.js 15+** (App Router) | Full-stack framework | SSR/SSG, API routes, Server Components, Server Actions, excellent DX, Vercel deployment | Remix (less ecosystem), Nuxt (Vue-based)        |
| **TypeScript** (Strict Mode) | Type safety          | Catches bugs at compile time, self-documenting, essential for complex state             | Plain JS (too risky for distributed systems)    |
| **React 19**                 | UI library           | Component model, concurrent features, Suspense                                          | Svelte (smaller ecosystem), Solid (less mature) |

### Collaborative Editing

| Technology      | Role                 | Why Selected                                                                                                           | Alternatives Considered                                                                    |
| --------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Yjs**         | CRDT library         | Industry-standard CRDT, proven at scale (used by Notion, JupyterLab), excellent offline support, sub-millisecond merge | Automerge (slower for text), ShareDB (OT-based, needs server)                              |
| **TipTap**      | Rich-text editor     | Built on ProseMirror, first-class Yjs binding, extensible, great API                                                   | Slate.js (weaker Yjs support), Lexical (newer, less proven), Quill (limited extensibility) |
| **y-indexeddb** | Client persistence   | Persists Yjs document to IndexedDB automatically, handles large docs                                                   | Custom IndexedDB (more work, same result)                                                  |
| **Hocuspocus**  | Collaboration server | Purpose-built Yjs WebSocket server, handles auth/persistence/webhooks, battle-tested                                   | Custom ws server (more code, same features), Liveblocks (proprietary, expensive)           |

### Database & ORM

| Technology                       | Role             | Why Selected                                                                                | Alternatives Considered                                            |
| -------------------------------- | ---------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **PostgreSQL** (Neon Serverless) | Primary database | Required by assignment, excellent for relational data, RLS support, JSONB for flexible data | Supabase (adds unnecessary abstraction)                            |
| **Drizzle ORM**                  | Database toolkit | Type-safe, lightweight, SQL-like syntax, excellent migrations, no runtime overhead          | Prisma (heavier runtime, slower queries), Knex (no type inference) |

### Authentication

| Technology                | Role           | Why Selected                                                                  | Alternatives Considered                                         |
| ------------------------- | -------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Auth.js v5** (NextAuth) | Authentication | Deep Next.js integration, multiple providers, session management, JWT support | Clerk (proprietary), Lucia (deprecated), custom JWT (more code) |

### Styling & UI

| Technology          | Role              | Why Selected                                                                    | Alternatives Considered                                        |
| ------------------- | ----------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Tailwind CSS v4** | Styling           | Utility-first, excellent DX, tree-shaking, consistent design                    | CSS Modules (more files), styled-components (runtime overhead) |
| **shadcn/ui**       | Component library | Radix-based, accessible, copy-paste (no dependency lock-in), beautiful defaults | Chakra UI (heavier), MUI (opinionated)                         |
| **Framer Motion**   | Animations        | Declarative, performant, gesture support                                        | CSS animations (limited), react-spring (less ergonomic)        |

### AI Integration

| Technology             | Role             | Why Selected                                                              | Alternatives Considered                                    |
| ---------------------- | ---------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Vercel AI SDK**      | AI orchestration | Streaming, multiple providers, edge-compatible, great Next.js integration | LangChain (heavy), direct API calls (more boilerplate)     |
| **OpenAI GPT-4o-mini** | AI model         | Fast, cost-effective, excellent for writing assistance                    | Groq (faster but limited context), Claude (more expensive) |

### DevOps & Infrastructure

| Technology  | Role               | Why Selected                                                      | Alternatives Considered                                 |
| ----------- | ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------- |
| **Vercel**  | Next.js hosting    | Zero-config, edge functions, preview deployments, automatic CI/CD | Netlify (weaker Next.js support), AWS (over-engineered) |
| **Railway** | WebSocket server   | Simple container deployment, WebSocket support, auto-scaling      | Fly.io (more complex), Render (slower deploys)          |
| **Neon**    | PostgreSQL hosting | Serverless, branching, auto-scaling, generous free tier           | Supabase (too opinionated), PlanetScale (MySQL only)    |

### Testing

| Technology          | Role                   | Why Selected                            | Alternatives Considered                   |
| ------------------- | ---------------------- | --------------------------------------- | ----------------------------------------- |
| **Vitest**          | Unit/Integration tests | Fast, ESM-native, Jest-compatible API   | Jest (slower, CJS-focused)                |
| **Playwright**      | E2E tests              | Cross-browser, fast, reliable, great DX | Cypress (slower, limited browser support) |
| **Testing Library** | Component tests        | User-centric testing philosophy         | Enzyme (deprecated)                       |

---

## 3. Folder & Project Structure

```
edgedocs/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, type-check, test on PR
│       └── deploy.yml                # Deploy on merge to main
├── docs/
│   ├── ARCHITECTURE.md              # This document
│   ├── API.md                       # API documentation
│   ├── DATABASE.md                  # Schema documentation
│   ├── SYNC-ENGINE.md              # Sync engine deep-dive
│   ├── CONFLICT-RESOLUTION.md      # CRDT explanation
│   └── DEPLOYMENT.md               # Deployment guide
├── server/                          # Hocuspocus collaboration server
│   ├── src/
│   │   ├── index.ts                # Server entry point
│   │   ├── auth.ts                 # WebSocket auth middleware
│   │   ├── persistence.ts         # PostgreSQL persistence extension
│   │   ├── validation.ts          # Payload validation
│   │   ├── rate-limiter.ts        # Rate limiting
│   │   └── types.ts               # Server types
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile                  # For Railway deployment
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                # Authentication route group
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/           # Dashboard route group
│   │   │   ├── documents/
│   │   │   │   ├── page.tsx       # Document list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx   # Single document view
│   │   │   ├── settings/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (editor)/             # Editor route group
│   │   │   ├── [documentId]/
│   │   │   │   ├── page.tsx      # Full editor experience
│   │   │   │   └── loading.tsx
│   │   │   └── layout.tsx
│   │   ├── api/                   # API routes
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts
│   │   │   ├── documents/
│   │   │   │   ├── route.ts      # CRUD
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       ├── versions/
│   │   │   │       │   └── route.ts
│   │   │   │       ├── collaborators/
│   │   │   │       │   └── route.ts
│   │   │   │       └── sync/
│   │   │   │           └── route.ts
│   │   │   └── ai/
│   │   │       ├── complete/
│   │   │       │   └── route.ts
│   │   │       └── summarize/
│   │   │           └── route.ts
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Landing/redirect
│   │   ├── globals.css
│   │   └── providers.tsx         # Client providers
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── editor/               # Editor-specific components
│   │   │   ├── editor-root.tsx
│   │   │   ├── toolbar.tsx
│   │   │   ├── bubble-menu.tsx
│   │   │   ├── collaboration-cursor.tsx
│   │   │   ├── connection-status.tsx
│   │   │   ├── version-panel.tsx
│   │   │   └── ai-assistant.tsx
│   │   ├── dashboard/            # Dashboard components
│   │   │   ├── document-card.tsx
│   │   │   ├── document-grid.tsx
│   │   │   └── sidebar.tsx
│   │   └── shared/               # Shared components
│   │       ├── theme-toggle.tsx
│   │       ├── user-avatar.tsx
│   │       ├── loading-skeleton.tsx
│   │       └── keyboard-shortcut.tsx
│   ├── lib/
│   │   ├── crdt/                 # CRDT configuration
│   │   │   ├── provider.ts      # Yjs provider setup
│   │   │   ├── awareness.ts     # Cursor awareness
│   │   │   └── extensions.ts    # TipTap + Yjs extensions
│   │   ├── sync/                 # Sync engine
│   │   │   ├── engine.ts        # Core sync orchestration
│   │   │   ├── queue.ts         # Offline queue
│   │   │   ├── connectivity.ts  # Network detection
│   │   │   └── reconciler.ts    # State reconciliation
│   │   ├── storage/              # Client-side storage
│   │   │   ├── indexeddb.ts     # IndexedDB wrapper
│   │   │   └── document-store.ts # Document storage logic
│   │   ├── auth/                 # Auth utilities
│   │   │   ├── config.ts        # Auth.js configuration
│   │   │   ├── guards.ts        # Route protection
│   │   │   └── permissions.ts   # RBAC logic
│   │   ├── db/                   # Database
│   │   │   ├── index.ts         # Drizzle client
│   │   │   ├── schema.ts        # Schema definitions
│   │   │   ├── migrations/      # SQL migrations
│   │   │   └── queries/         # Reusable queries
│   │   │       ├── documents.ts
│   │   │       ├── versions.ts
│   │   │       └── collaborators.ts
│   │   ├── ai/                   # AI integration
│   │   │   ├── client.ts        # AI SDK client
│   │   │   └── prompts.ts       # System prompts
│   │   ├── validations/          # Zod schemas
│   │   │   ├── document.ts
│   │   │   ├── sync.ts
│   │   │   └── auth.ts
│   │   └── utils/                # Shared utilities
│   │       ├── cn.ts            # Class merging
│   │       ├── constants.ts
│   │       └── errors.ts        # Error classes
│   ├── hooks/                    # Custom React hooks
│   │   ├── use-document.ts
│   │   ├── use-sync-status.ts
│   │   ├── use-online-status.ts
│   │   ├── use-version-history.ts
│   │   └── use-keyboard-shortcuts.ts
│   ├── types/                    # TypeScript types
│   │   ├── document.ts
│   │   ├── collaboration.ts
│   │   ├── sync.ts
│   │   └── auth.ts
│   └── config/                   # App configuration
│       ├── site.ts
│       └── editor.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── public/
│   └── icons/
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── .env.example
├── .env.local                   # Local environment (gitignored)
└── README.md
```

### Design Decision: Monorepo with Separate Server

**Why**: The Hocuspocus WebSocket server runs as a separate process because:

1. Vercel's serverless architecture doesn't support persistent WebSocket connections
2. Separation of concerns — the collaboration server has different scaling requirements
3. Independent deployment cycles — editor features ship without redeploying the WS server
4. The WS server needs to be stateful (holds documents in memory), while Next.js is stateless

**Alternative**: Using Partykit or Cloudflare Durable Objects for WebSocket management.

- Pros: Simpler deployment, edge-distributed
- Cons: Vendor lock-in, less control over persistence logic, harder to debug

**Trade-off**: Slightly more complex infrastructure for full control and no vendor lock-in.

---

## 4. Database Schema & Relationships

```sql
-- Users table (managed by Auth.js)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT,
  email         TEXT UNIQUE NOT NULL,
  email_verified TIMESTAMPTZ,
  image         TEXT,
  password_hash TEXT,              -- For credentials provider
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Documents
CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL DEFAULT 'Untitled',
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Yjs document state (binary)
  yjs_state     BYTEA,            -- Latest merged Yjs document state

  -- Metadata
  word_count    INTEGER DEFAULT 0,
  is_archived   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  last_edited_by UUID REFERENCES users(id)
);

-- Document collaborators (RBAC)
CREATE TABLE document_collaborators (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(document_id, user_id)
);

-- Document versions (snapshots)
CREATE TABLE document_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Yjs snapshot data
  yjs_snapshot  BYTEA NOT NULL,   -- Yjs snapshot binary
  yjs_state_vector BYTEA,         -- State vector at snapshot time

  -- Metadata
  title         TEXT,             -- Optional version label
  description   TEXT,             -- Optional description
  created_by    UUID NOT NULL REFERENCES users(id),
  word_count    INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  -- Ordering
  version_number INTEGER NOT NULL,

  UNIQUE(document_id, version_number)
);

-- Sync metadata (tracks what each client has synced)
CREATE TABLE sync_states (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Last known state vector for this client
  state_vector  BYTEA,
  last_synced   TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(document_id, user_id)
);

-- Indexes
CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_updated ON documents(updated_at DESC);
CREATE INDEX idx_collaborators_user ON document_collaborators(user_id);
CREATE INDEX idx_collaborators_document ON document_collaborators(document_id);
CREATE INDEX idx_versions_document ON document_versions(document_id, version_number DESC);
CREATE INDEX idx_sync_states_document ON sync_states(document_id);

-- Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (enforced at DB level for defense-in-depth)
CREATE POLICY "Users can view documents they own or collaborate on"
  ON documents FOR SELECT
  USING (
    owner_id = current_setting('app.current_user_id')::UUID
    OR id IN (
      SELECT document_id FROM document_collaborators
      WHERE user_id = current_setting('app.current_user_id')::UUID
    )
  );

CREATE POLICY "Only owners can delete documents"
  ON documents FOR DELETE
  USING (owner_id = current_setting('app.current_user_id')::UUID);
```

### Entity Relationship Diagram

```
┌──────────┐       ┌─────────────────────┐       ┌──────────────────┐
│  users   │       │  document_          │       │   documents      │
│          │──1:N──│  collaborators      │──N:1──│                  │
│  id (PK) │       │  role: owner|       │       │  id (PK)         │
│  email   │       │       editor|viewer │       │  title           │
│  name    │       │  user_id (FK)       │       │  owner_id (FK)   │
└──────────┘       │  document_id (FK)   │       │  yjs_state       │
     │             └─────────────────────┘       │  updated_at      │
     │                                           └────────┬─────────┘
     │                                                    │
     │             ┌─────────────────────┐                │
     └────────────│  document_versions   │──N:1───────────┘
                   │                     │
                   │  yjs_snapshot       │
                   │  version_number     │
                   │  created_by (FK)    │
                   └─────────────────────┘
```

### Design Decision: Binary Yjs State in PostgreSQL

**Why**: Storing the Yjs document as `BYTEA` rather than converting to JSON:

1. Yjs's binary encoding is 10-100x more compact than equivalent JSON
2. No lossy conversion — preserves full CRDT metadata needed for conflict resolution
3. Snapshots/restore operate directly on binary state (no serialization overhead)
4. PostgreSQL handles BYTEA efficiently with TOAST compression

**Alternative**: Storing document content as JSONB

- Pros: Queryable content, easier debugging
- Cons: Loses CRDT metadata, cannot reconstruct history, 10x larger storage, cannot merge correctly

**Trade-off**: Slightly harder to debug raw data, but we provide API endpoints that decode state for inspection.

---

## 5. Authentication & Authorization Architecture

### Authentication Flow

```
┌─────────┐         ┌──────────┐         ┌────────────┐
│  Client │         │ Next.js  │         │ PostgreSQL │
│ Browser │         │ Auth.js  │         │            │
└────┬────┘         └────┬─────┘         └─────┬──────┘
     │                   │                      │
     │  POST /api/auth   │                      │
     │  {email, password}│                      │
     │──────────────────▶│                      │
     │                   │  Verify credentials  │
     │                   │─────────────────────▶│
     │                   │                      │
     │                   │  User record         │
     │                   │◀─────────────────────│
     │                   │                      │
     │  Set HTTP-only    │                      │
     │  session cookie   │                      │
     │◀──────────────────│                      │
     │                   │                      │
     │  GET /editor/:id  │                      │
     │──────────────────▶│                      │
     │                   │  Validate session    │
     │                   │  + Check document    │
     │                   │  permission          │
     │                   │─────────────────────▶│
     │                   │                      │
     │  Page + WS token  │  Role: editor        │
     │◀──────────────────│◀─────────────────────│
     │                   │                      │
     │  WSS connect      │                      │
     │  + JWT token      │                      │
     │──────────────────▶│  (Hocuspocus)        │
     │                   │                      │
```

### Authorization Model

| Role       | Create Doc | Edit Doc | View Doc | Delete Doc | Manage Collaborators | Capture Version | Restore Version |
| ---------- | ---------- | -------- | -------- | ---------- | -------------------- | --------------- | --------------- |
| **Owner**  | ✅         | ✅       | ✅       | ✅         | ✅                   | ✅              | ✅              |
| **Editor** | —          | ✅       | ✅       | —          | —                    | ✅              | —               |
| **Viewer** | —          | —        | ✅       | —          | —                    | —               | —               |

### WebSocket Authentication

The collaboration server (Hocuspocus) validates a short-lived JWT token on connection:

1. Client requests a WebSocket token from `/api/documents/[id]/sync` (Next.js validates session + permissions)
2. Next.js generates a JWT with: `{ userId, documentId, role, exp: 5min }`
3. Client connects to Hocuspocus with this token
4. Hocuspocus `onAuthenticate` hook validates the JWT signature
5. If role === 'viewer', the connection is set to read-only (Hocuspocus blocks write operations)

**Why short-lived tokens**: If a user's permission is revoked, the token expires in 5 minutes, forcing re-authentication. The client automatically refreshes tokens in the background.

### Design Decision: Auth.js with Credentials + OAuth

**Why**:

- Credentials provider for email/password (simpler for demo, no external OAuth setup needed)
- Google OAuth as secondary option
- JWT strategy for session (stateless, works with WebSocket auth)

**Alternative**: Clerk or Supabase Auth

- Pros: Less code, hosted UI
- Cons: Proprietary, adds external dependency, less control over token structure

---

## 6. Local-First Architecture

### Core Principle

> The local Yjs document in IndexedDB is the **source of truth** for the client. The server is a synchronization peer, not an authority.

### Architecture

```
┌─────────────────────────────────────────────────┐
│                  Browser                          │
│                                                  │
│  ┌────────────┐    ┌──────────────────────────┐  │
│  │  TipTap    │    │      Yjs Document        │  │
│  │  Editor    │◀──▶│  (Y.Doc in memory)       │  │
│  │            │    │                          │  │
│  └────────────┘    └─────────┬────────────────┘  │
│                              │                    │
│              ┌───────────────┼───────────────┐    │
│              │               │               │    │
│              ▼               ▼               ▼    │
│  ┌───────────────┐ ┌──────────────┐ ┌─────────┐ │
│  │  IndexedDB    │ │  WebSocket   │ │ Awareness│ │
│  │  Provider     │ │  Provider    │ │ Protocol │ │
│  │  (y-indexeddb)│ │  (y-websocket)│ │ (cursors)│ │
│  │              │ │              │ │         │ │
│  │  ALWAYS ON   │ │ WHEN ONLINE  │ │  ONLINE │ │
│  └───────────────┘ └──────────────┘ └─────────┘ │
│                                                  │
└──────────────────────────────────────────────────┘
```

### How It Works

1. **Document Open**:
   - Load Yjs document from IndexedDB (instant, no network)
   - Simultaneously attempt WebSocket connection
   - If online, sync with server (merge any remote changes)
   - If offline, user edits immediately with full functionality

2. **During Editing**:
   - Every keystroke creates a Yjs update (tiny binary diff)
   - Update is immediately applied to in-memory doc (instant UI response)
   - Update is persisted to IndexedDB (survives tab close)
   - If online: update is sent via WebSocket to collaboration server

3. **Tab Close/Crash Recovery**:
   - On next open, Yjs document is reconstructed from IndexedDB
   - All offline edits are preserved
   - Sync resumes where it left off

### Zero-Latency Guarantee

The UI NEVER waits for network operations:

- Typing latency: <1ms (direct Yjs update → ProseMirror transaction)
- Save latency: 0ms (IndexedDB write is async, non-blocking)
- The only network-dependent UI element is the connection status indicator

### Storage Budget Management

For large documents, IndexedDB can grow significantly. Mitigation:

- **Compaction**: Periodically merge Yjs updates into a single state (reduces storage by ~80%)
- **Threshold**: If a document exceeds 5MB locally, prompt the user and offer to compact
- **Garbage Collection**: Remove compacted update history after successful server sync

---

## 7. Offline Synchronization Engine

### State Machine

```
                    ┌─────────┐
                    │  IDLE   │
                    └────┬────┘
                         │ Document opened
                         ▼
                    ┌─────────┐
              ┌─────│ SYNCING │─────┐
              │     └────┬────┘     │
    Network   │          │          │  Network
    lost      │    Sync complete    │  error
              │          │          │
              ▼          ▼          ▼
        ┌──────────┐ ┌────────┐ ┌──────────┐
        │ OFFLINE  │ │ SYNCED │ │  ERROR   │
        │ QUEUING  │ │        │ │ (retry)  │
        └────┬─────┘ └────────┘ └────┬─────┘
             │                        │
             │  Network restored      │  Retry timer
             │                        │
             └────────────┬───────────┘
                          │
                          ▼
                    ┌───────────┐
                    │ RESOLVING │ (push local, pull remote)
                    └─────┬─────┘
                          │
                          ▼
                    ┌─────────┐
                    │ SYNCED  │
                    └─────────┘
```

### Sync Algorithm (Step-by-Step)

```
WHEN connection restored:

1. READ local state vector from Yjs document
2. SEND state vector to server: "Here's what I have"
3. SERVER computes diff: "Here's what you're missing"
4. CLIENT applies remote diff to local Yjs document
   → CRDT guarantees this merge is conflict-free
5. CLIENT computes what server is missing (from local updates stored since last sync)
6. SEND missing updates to server
7. SERVER applies updates (CRDT merge)
8. SERVER broadcasts to other connected clients
9. MARK sync complete, update UI indicator
```

### Retry Strategy

| Attempt | Delay | Strategy                          |
| ------- | ----- | --------------------------------- |
| 1       | 1s    | Immediate retry                   |
| 2       | 2s    | Exponential backoff               |
| 3       | 4s    | Exponential backoff               |
| 4       | 8s    | Exponential backoff               |
| 5+      | 30s   | Cap at 30s, continue indefinitely |

### Conflict Scenario Example

```
Timeline:
─────────────────────────────────────────────────────────────

User A (online):     "Hello World" → "Hello Beautiful World"
                          │
User B (offline):    "Hello World" → "Hello World!"
                                          │
                          Network restored ▼

CRDT Resolution:
- User A inserted "Beautiful " at position 6
- User B inserted "!" at position 11
- CRDT: Both insertions are independent, both apply
- Result: "Hello Beautiful World!"
- This is DETERMINISTIC: any ordering of these operations yields the same result
```

### Design Decision: Yjs State Vector Sync

**Why**: Yjs's built-in sync protocol uses state vectors (a compact representation of "what this client has seen") to compute minimal diffs. This means:

- Only missing updates are transferred (not the full document)
- Bandwidth is proportional to changes made, not document size
- Works perfectly with intermittent connectivity

**Alternative**: Full document transfer on reconnect

- Pros: Simpler implementation
- Cons: Wastes bandwidth (sending unchanged content), doesn't scale for large documents

---

## 8. Deterministic Conflict Resolution Strategy

### Why CRDTs (Conflict-free Replicated Data Types)

Traditional approaches to conflict resolution:

1. **Last-Write-Wins (LWW)**: Destroys concurrent edits — unacceptable
2. **Operational Transformation (OT)**: Requires central server, complex, not offline-compatible
3. **Manual merge (like Git)**: Terrible UX for real-time editing

**CRDTs guarantee**: If all replicas receive the same set of operations (in any order), they converge to the same state. No conflicts are possible.

### Yjs's YATA Algorithm

Yjs implements a sequence CRDT called YATA (Yet Another Transformation Approach):

1. Every character insertion gets a unique ID: `(clientId, clock)`
2. Each insertion references its left and right neighbors at time of creation
3. When concurrent insertions target the same position, they are ordered deterministically by `clientId`

```
Example: Two users type at the same position simultaneously

User A (clientId: 1): Insert "X" between positions 5 and 6
User B (clientId: 2): Insert "Y" between positions 5 and 6

Resolution rule: Lower clientId goes first
Result: "...XY..." (always, regardless of reception order)

This is DETERMINISTIC because:
- Same inputs → same output
- No server coordination needed
- No timestamp dependency
- Works offline
```

### Handling Complex Conflicts

| Scenario                         | Resolution                                                      |
| -------------------------------- | --------------------------------------------------------------- |
| Same position insert             | Ordered by clientId (deterministic)                             |
| Overlapping delete + insert      | Insert wins (content preservation)                              |
| Concurrent formatting            | Last-observed formatting wins per character                     |
| Delete of remotely-modified text | Delete wins, modifications lost (standard text editor behavior) |

### Why Not Manual Conflict Resolution?

In a real-time collaborative editor, asking users to "resolve conflicts" would be disastrous UX. CRDTs ensure that the document always converges to a valid, predictable state without user intervention.

---

## 9. Version History Implementation

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Version Timeline                     │
│                                                      │
│  v1        v2        v3        v4 (current)         │
│  ●─────────●─────────●─────────●                    │
│  │         │         │         │                    │
│  snapshot  snapshot  snapshot  live doc              │
│  (binary)  (binary)  (binary)  (Yjs state)          │
│                                                      │
│  Each snapshot = Yjs.snapshot(doc) at that moment    │
│  Diff = computed by Yjs between any two snapshots    │
└─────────────────────────────────────────────────────┘
```

### How Snapshots Work

1. **Capture**: When user clicks "Save Version":
   - `Y.snapshot(doc)` captures the current document state as a lightweight pointer
   - The snapshot references existing Yjs updates (doesn't duplicate content)
   - Snapshot + metadata stored in PostgreSQL

2. **View Past Version**:
   - Reconstruct document at snapshot time using `Y.createDocFromSnapshot(doc, snapshot)`
   - Render in read-only mode with diff highlighting against current version

3. **Restore Version** (Non-Destructive):
   - Compute diff between current state and target snapshot
   - Apply reverse operations as NEW updates to the Yjs document
   - This preserves history — restoration is itself a new edit
   - Other collaborators see the restoration as normal edits (no corruption)

### Auto-Versioning Rules

| Trigger                           | Action                 |
| --------------------------------- | ---------------------- |
| User manually saves               | Create named snapshot  |
| Every 50 edits (configurable)     | Create auto-snapshot   |
| Before collaboration session ends | Create checkpoint      |
| Before restore operation          | Create safety snapshot |

### Design Decision: Yjs Snapshots vs. Full State Copies

**Why Yjs Snapshots**:

- Extremely lightweight (just a state vector + delete set, typically <1KB)
- Can reconstruct any version from the shared update history
- Diffs are computed lazily, not stored

**Alternative**: Storing full document state per version

- Pros: Simpler to reconstruct, independent of update history
- Cons: Storage grows linearly (100 versions × document size), no efficient diffs

**Trade-off**: We store periodic full state backups (every 10 versions) as a safety net in case update history is corrupted.

---

## 10. Real-Time Collaboration Architecture

### Hocuspocus Server Configuration

```
┌────────────────────────────────────────────────────────────┐
│                   Hocuspocus Server                          │
│                                                             │
│  ┌───────────────┐                                          │
│  │  onAuthenticate│ → Validate JWT → Extract role            │
│  └───────────────┘                                          │
│                                                             │
│  ┌───────────────┐                                          │
│  │  onConnect     │ → Check payload size → Rate limit        │
│  └───────────────┘                                          │
│                                                             │
│  ┌───────────────┐                                          │
│  │  onChange      │ → Validate update → Persist to DB        │
│  └───────────────┘                                          │
│                                                             │
│  ┌───────────────┐                                          │
│  │  onDisconnect  │ → Clean up awareness → Log metrics       │
│  └───────────────┘                                          │
│                                                             │
│  Document held in memory while ≥1 client connected          │
│  Flushed to PostgreSQL on last disconnect + periodic saves   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Awareness Protocol (Cursor Sharing)

Each connected client broadcasts its "awareness" state:

```typescript
{
  user: { name: "Alice", color: "#FF6B6B" },
  cursor: { anchor: 145, head: 145 },  // Selection positions
  isTyping: true
}
```

This enables:

- Live cursor positions of other users
- User presence indicators
- "User is typing..." indicators

### Scaling Considerations

For the scope of this project, a single Hocuspocus instance handles all documents. For production scale:

- Documents are loaded/unloaded on demand
- Memory usage: ~1-5KB per active document (Yjs is very efficient)
- Can handle 1000+ concurrent connections per instance
- Horizontal scaling: Shard by document ID (future enhancement)

---

## 11. API Design

### REST API Routes

| Method   | Path                                         | Auth | Role         | Description              |
| -------- | -------------------------------------------- | ---- | ------------ | ------------------------ |
| `POST`   | `/api/auth/register`                         | —    | —            | Register new user        |
| `POST`   | `/api/auth/[...nextauth]`                    | —    | —            | Auth.js handlers         |
| `GET`    | `/api/documents`                             | ✅   | any          | List user's documents    |
| `POST`   | `/api/documents`                             | ✅   | any          | Create new document      |
| `GET`    | `/api/documents/[id]`                        | ✅   | any role     | Get document metadata    |
| `PATCH`  | `/api/documents/[id]`                        | ✅   | owner/editor | Update metadata (title)  |
| `DELETE` | `/api/documents/[id]`                        | ✅   | owner        | Delete document          |
| `GET`    | `/api/documents/[id]/versions`               | ✅   | any role     | List version history     |
| `POST`   | `/api/documents/[id]/versions`               | ✅   | owner/editor | Create version snapshot  |
| `GET`    | `/api/documents/[id]/versions/[vid]`         | ✅   | any role     | Get specific version     |
| `POST`   | `/api/documents/[id]/versions/[vid]/restore` | ✅   | owner        | Restore to version       |
| `GET`    | `/api/documents/[id]/collaborators`          | ✅   | owner        | List collaborators       |
| `POST`   | `/api/documents/[id]/collaborators`          | ✅   | owner        | Add collaborator         |
| `DELETE` | `/api/documents/[id]/collaborators/[uid]`    | ✅   | owner        | Remove collaborator      |
| `POST`   | `/api/documents/[id]/sync/token`             | ✅   | any role     | Get WebSocket auth token |
| `POST`   | `/api/ai/complete`                           | ✅   | —            | AI text completion       |
| `POST`   | `/api/ai/summarize`                          | ✅   | —            | AI document summary      |

### Request/Response Validation

Every API route validates input with Zod schemas:

```typescript
// Example: Create document
const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(255).trim(),
});

// Example: Sync payload validation
const SyncPayloadSchema = z.object({
  update: z.instanceof(Uint8Array).refine(
    (data) => data.byteLength <= MAX_SYNC_PAYLOAD_SIZE, // 1MB max
    "Sync payload exceeds maximum size",
  ),
  stateVector: z.instanceof(Uint8Array).optional(),
});
```

---

## 12. Security Architecture

### Threat Model & Mitigations

| Threat                                 | Impact               | Mitigation                                                             |
| -------------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| **OOM attack via large sync payload**  | Server crash         | Payload size limit (1MB), streaming validation, connection termination |
| **Malformed Yjs update**               | Document corruption  | Validate binary structure before merge, reject invalid updates         |
| **Unauthorized document access**       | Data leak            | JWT + RLS + middleware permission checks at every layer                |
| **Viewer pushing edits via WebSocket** | Unauthorized write   | Role checked on WebSocket connect + on every incoming message          |
| **Session hijacking**                  | Account takeover     | HTTP-only cookies, short-lived tokens, CSRF protection                 |
| **SQL injection**                      | Data breach          | Parameterized queries via Drizzle ORM (never raw SQL)                  |
| **XSS via document content**           | Script execution     | TipTap sanitizes HTML output, CSP headers                              |
| **CSRF**                               | Unauthorized actions | SameSite cookies, CSRF token verification                              |
| **Rate limiting bypass**               | DoS                  | Per-IP + per-user rate limits on API and WebSocket                     |

### Defense-in-Depth Layers

```
Layer 1: Network
  → Cloudflare/Vercel edge (DDoS protection)
  → TLS everywhere (HTTPS + WSS)

Layer 2: Application Middleware
  → Rate limiting (sliding window, per-route)
  → CORS (strict origin checking)
  → CSP headers
  → Request size limits

Layer 3: Authentication
  → Auth.js session validation
  → JWT signature verification (WebSocket)
  → Token expiration (5min for WS tokens)

Layer 4: Authorization
  → Middleware permission checks
  → API route-level RBAC
  → WebSocket role enforcement

Layer 5: Database
  → Row Level Security (RLS)
  → Parameterized queries
  → Connection pooling with PgBouncer

Layer 6: Data Validation
  → Zod schema validation on all inputs
  → Binary payload size limits
  → Yjs update structure validation
```

### Payload Size Protection

```typescript
// WebSocket connection handler
onConnect({ connection, requestPayload }) {
  // Hard limit: reject connections with oversized initial payload
  if (requestPayload && requestPayload.byteLength > MAX_INITIAL_PAYLOAD) {
    throw new Error('Payload too large');
  }

  // Per-connection rate: max 100 updates/second, max 1MB/update
  connection.rateLimit = new RateLimiter({
    maxUpdatesPerSecond: 100,
    maxPayloadSize: 1_048_576, // 1MB
    maxTotalPerMinute: 50_000_000, // 50MB/min
  });
}
```

---

## 13. Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     GitHub Repository                     │
│                                                          │
│  Push to main → GitHub Actions CI/CD                     │
└─────────────────────┬──────────────┬─────────────────────┘
                      │              │
          ┌───────────▼──┐    ┌──────▼──────────┐
          │   Vercel      │    │   Railway       │
          │               │    │                 │
          │  Next.js App  │    │  Hocuspocus     │
          │  (Frontend +  │    │  WebSocket      │
          │   API Routes) │    │  Server         │
          │               │    │                 │
          │  Auto-deploy  │    │  Docker deploy  │
          │  on push      │    │  on push        │
          └───────┬───────┘    └────────┬────────┘
                  │                     │
                  └──────────┬──────────┘
                             │
                    ┌────────▼────────┐
                    │   Neon          │
                    │   PostgreSQL    │
                    │                 │
                    │  Serverless     │
                    │  Auto-scaling   │
                    │  Connection     │
                    │  pooling        │
                    └─────────────────┘
```

### Environment Variables Required

```bash
# Database
DATABASE_URL=postgresql://...@neon.tech/edgedocs

# Auth
NEXTAUTH_SECRET=<random-32-chars>
NEXTAUTH_URL=https://edgedocs.vercel.app

# WebSocket Server
NEXT_PUBLIC_WS_URL=wss://edgedocs-ws.railway.app
WS_JWT_SECRET=<random-32-chars>

# AI
OPENAI_API_KEY=sk-...

# Optional: OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### CI/CD Pipeline

```yaml
# On Pull Request:
1. Install dependencies
2. TypeScript type-check
3. ESLint
4. Unit tests (Vitest)
5. Build check
6. Preview deployment (Vercel)

# On Merge to Main:
1. All PR checks
2. E2E tests (Playwright)
3. Deploy to production (Vercel + Railway)
4. Database migrations (Drizzle)
5. Smoke tests against production
```

---

## 14. Testing Strategy

### Test Pyramid

```
         ┌─────────┐
         │   E2E   │  5-10 critical flows
         │Playwright│  (login → edit → sync → version)
         └────┬────┘
              │
        ┌─────▼─────┐
        │Integration │  20-30 tests
        │ (API routes│  (auth + RBAC + sync endpoints)
        │  + DB)     │
        └─────┬──────┘
              │
    ┌─────────▼─────────┐
    │    Unit Tests      │  50+ tests
    │  (Sync engine,     │  (CRDT operations, conflict resolution,
    │   validation,      │   queue logic, utility functions)
    │   business logic)  │
    └───────────────────┘
```

### Key Test Scenarios

| Category        | Test                                               |
| --------------- | -------------------------------------------------- |
| **Sync Engine** | Offline edits merge correctly on reconnect         |
| **Sync Engine** | Concurrent edits from 3 users converge             |
| **Sync Engine** | Large payload rejected, connection preserved       |
| **Conflict**    | Same-position insertions resolve deterministically |
| **Conflict**    | Delete + edit conflict resolves correctly          |
| **Version**     | Snapshot captures exact document state             |
| **Version**     | Restore creates new version, doesn't corrupt state |
| **Auth**        | Viewer cannot push edits via WebSocket             |
| **Auth**        | Expired token is rejected                          |
| **Security**    | Oversized payload returns 413, doesn't crash       |
| **Performance** | 10,000 character document loads in <100ms          |

---

## 15. Performance Optimization Strategy

### Client-Side Performance

| Technique                 | Implementation                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| **Zero-latency editing**  | Yjs updates are applied synchronously to in-memory doc; IndexedDB + network are async             |
| **Debounced persistence** | IndexedDB writes debounced to 500ms (batch rapid keystrokes)                                      |
| **Code splitting**        | Editor loaded dynamically; dashboard bundle doesn't include TipTap                                |
| **React optimization**    | `memo()` for editor toolbar, `useMemo` for version list, `startTransition` for non-urgent updates |
| **Virtual scrolling**     | Version history list uses virtualization for 100+ versions                                        |
| **Web Workers**           | Yjs document operations can be offloaded to a worker for large documents (future)                 |
| **Bundle size**           | Tree-shaking, dynamic imports, analyze with `@next/bundle-analyzer`                               |

### Server-Side Performance

| Technique              | Implementation                                                 |
| ---------------------- | -------------------------------------------------------------- |
| **Connection pooling** | Neon's serverless driver with built-in pooling                 |
| **Document caching**   | Hocuspocus keeps active documents in memory                    |
| **Lazy loading**       | Documents loaded into memory only when first client connects   |
| **Periodic flush**     | Persist to DB every 30s while active (not on every keystroke)  |
| **Compression**        | Yjs binary updates are already compact; gzip on HTTP responses |

### Performance Budgets

| Metric                         | Target          |
| ------------------------------ | --------------- |
| First Contentful Paint (FCP)   | < 1.2s          |
| Largest Contentful Paint (LCP) | < 2.0s          |
| Time to Interactive (TTI)      | < 2.5s          |
| Editor input latency           | < 16ms (60fps)  |
| Document open (from IndexedDB) | < 100ms         |
| Sync reconnection              | < 2s            |
| Bundle size (editor page)      | < 200KB gzipped |

---

## 16. AI Features Architecture

### Planned AI Features

| Feature              | Description                              | Implementation                                        |
| -------------------- | ---------------------------------------- | ----------------------------------------------------- |
| **AI Autocomplete**  | Inline text suggestions as user types    | Vercel AI SDK + GPT-4o-mini, triggered after 2s pause |
| **Document Summary** | Generate document summary/abstract       | On-demand, displayed in sidebar                       |
| **Grammar & Style**  | Fix grammar, improve clarity             | Selection-based action in bubble menu                 |
| **Continue Writing** | Generate next paragraph based on context | Streaming response inserted at cursor                 |
| **Title Suggestion** | Auto-suggest document title from content | Triggered on first 100 words                          |

### AI Architecture

```
User action (e.g., "Improve this paragraph")
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  Next.js API    │      │  Vercel AI SDK   │
│  /api/ai/...    │─────▶│  (streaming)     │
│                 │      │                  │
│  Rate limited   │      │  Provider:       │
│  Auth required  │      │  OpenAI GPT-4o   │
└─────────────────┘      └────────┬─────────┘
                                  │
                                  ▼ Streamed tokens
                         ┌─────────────────┐
                         │  Client renders │
                         │  inline as they │
                         │  arrive         │
                         └─────────────────┘
```

### AI Safety

- Rate limit: 20 AI requests per user per hour
- Input sanitization: Strip document content to text-only before sending to AI
- Output validation: AI-generated content is inserted as plain text (no HTML injection)
- Cost control: Use GPT-4o-mini (low cost), set max_tokens per request

---

## 17. Implementation Roadmap

### Module Order (Priority by Evaluation Impact)

| #   | Module                                             | Priority | Est. Complexity | Rationale                                 |
| --- | -------------------------------------------------- | -------- | --------------- | ----------------------------------------- |
| 1   | Project Setup & Configuration                      | Critical | Low             | Foundation for everything                 |
| 2   | Database Schema & Migrations                       | Critical | Medium          | Data model must be correct first          |
| 3   | Authentication & Authorization                     | Critical | Medium          | Required by all features                  |
| 4   | Document CRUD (Dashboard)                          | Critical | Medium          | Basic functionality, demonstrates Next.js |
| 5   | Editor with Local-First (TipTap + Yjs + IndexedDB) | Critical | High            | Core differentiator                       |
| 6   | Real-Time Collaboration (Hocuspocus)               | Critical | High            | Core differentiator                       |
| 7   | Offline Sync Engine                                | Critical | High            | Core differentiator                       |
| 8   | Version History & Time Travel                      | Critical | Medium          | Key requirement                           |
| 9   | AI Features                                        | Medium   | Medium          | "Good to have" but impressive             |
| 10  | Security Hardening                                 | Critical | Medium          | Explicit requirement                      |
| 11  | Testing                                            | Medium   | Medium          | Demonstrates quality                      |
| 12  | Deployment & CI/CD                                 | Critical | Low             | Required for submission                   |
| 13  | Polish & Documentation                             | Medium   | Low             | Final touches                             |

### Time Budget Allocation (8-12 hours)

| Phase                  | Hours | Modules    |
| ---------------------- | ----- | ---------- |
| Architecture & Setup   | 1h    | #1, #2     |
| Auth & Dashboard       | 2h    | #3, #4     |
| Editor & Collaboration | 3h    | #5, #6, #7 |
| Version History & AI   | 2h    | #8, #9     |
| Security & Testing     | 1.5h  | #10, #11   |
| Deployment & Polish    | 1.5h  | #12, #13   |

---

## Appendix: Key Architectural Trade-offs

### Trade-off 1: Yjs vs. Automerge

| Criteria          | Yjs                         | Automerge       |
| ----------------- | --------------------------- | --------------- |
| Performance       | ⭐⭐⭐⭐⭐ (60x faster)     | ⭐⭐⭐          |
| Bundle size       | ~15KB                       | ~200KB          |
| Ecosystem         | TipTap, ProseMirror, Monaco | Limited         |
| Maturity          | 8+ years, production proven | Newer           |
| Memory efficiency | Excellent                   | Higher overhead |

**Decision**: Yjs. The performance gap is too significant to ignore for a real-time editor.

### Trade-off 2: TipTap vs. Slate.js vs. Lexical

| Criteria              | TipTap                 | Slate.js         | Lexical      |
| --------------------- | ---------------------- | ---------------- | ------------ |
| Yjs integration       | First-class (official) | Community plugin | Experimental |
| API ergonomics        | ⭐⭐⭐⭐⭐             | ⭐⭐⭐           | ⭐⭐⭐⭐     |
| Rich text features    | Complete               | Build-your-own   | Moderate     |
| Documentation         | Excellent              | Good             | Growing      |
| Collaboration support | Native                 | Manual           | Manual       |

**Decision**: TipTap. Native Yjs collaboration support means less custom code and fewer bugs.

### Trade-off 3: Drizzle vs. Prisma

| Criteria         | Drizzle                    | Prisma                      |
| ---------------- | -------------------------- | --------------------------- |
| Runtime overhead | Zero (compiles to SQL)     | Heavy (query engine binary) |
| Type safety      | Full                       | Full                        |
| Raw SQL access   | Easy                       | Awkward                     |
| Serverless       | ⭐⭐⭐⭐⭐ (no cold start) | ⭐⭐⭐ (engine startup)     |
| RLS support      | Direct SQL                 | Limited                     |
| Bundle size      | Tiny                       | 2-8MB engine                |

**Decision**: Drizzle. Zero runtime overhead is critical for serverless deployment on Vercel, and direct SQL access is needed for RLS policies.

---

## Questions Before Proceeding

Before I begin implementation, I need the following confirmed:

1. **Approval of this architecture** — Any concerns or modifications?
2. **Neon PostgreSQL** — Should I set this up, or do you have an existing database?
3. **Railway** — For the WebSocket server. Acceptable, or prefer another platform?
4. **AI Provider** — OpenAI (GPT-4o-mini) acceptable? Or prefer Groq/Gemini?
5. **OAuth** — Should I include Google OAuth, or credentials-only auth is sufficient?
6. **Your name/GitHub/LinkedIn** — For the footer (required by assignment)

---

_Document Version: 1.0_
_Last Updated: 2026-07-04_
