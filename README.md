# EdgeDocs

[![CI](https://github.com/rishiksinha59/edgedocs/actions/workflows/ci.yml/badge.svg)](https://github.com/rishiksinha59/edgedocs/actions/workflows/ci.yml)

A local-first, collaborative document editor with offline synchronization, deterministic conflict resolution, and granular version control. Built with Next.js 16, Yjs CRDTs, and PostgreSQL.

**Live Demo:** [edgedocs.vercel.app](https://edgedocs.vercel.app)

---

## Features

- **Local-First Editing** — Zero-latency typing. Documents are stored in IndexedDB and work fully offline with no network requests blocking the UI.
- **Real-Time Collaboration** — Multiple users edit simultaneously via WebSocket (Hocuspocus). Cursor presence and live sync across all connected clients.
- **Deterministic Conflict Resolution** — Yjs CRDTs guarantee mathematically convergent merges. No last-write-wins, no data loss, regardless of edit ordering.
- **Offline Sync Engine** — Edits made offline are queued locally. On reconnect, the sync engine automatically reconciles local and remote state without overwriting work.
- **Version History & Time Travel** — Capture named snapshots. Browse a timeline of past versions. Restore any previous state safely via CRDT-correct transactional replay.
- **Granular RBAC** — Documents support Owner, Editor, and Viewer roles. Viewers cannot push state updates to the real-time server (`readOnly` enforced server-side).
- **AI Writing Assistant** — Groq LLM integration for continue writing, summarize, grammar fix, clarity improvement, tone adjustment, and text expansion/shortening.
- **Dark Mode** — System-aware theme toggle (Light / Dark / System).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser Client                      │
│                                                          │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐ │
│  │  TipTap   │──▶│   Yjs Doc    │──▶│   IndexedDB      │ │
│  │  Editor   │   │   (CRDT)     │   │   (y-indexeddb)   │ │
│  └──────────┘   └──────┬───────┘   └──────────────────┘ │
│                         │ WebSocket                       │
└─────────────────────────┼────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │   Hocuspocus Server    │
              │   (Railway / Docker)   │
              │                        │
              │  • JWT Authentication  │
              │  • Role Enforcement    │
              │  • 1MB Payload Limit   │
              │  • PostgreSQL Persist  │
              └───────────┬────────────┘
                          │
              ┌───────────▼───────────┐
              │   Neon PostgreSQL      │
              │                        │
              │  • Users & Auth        │
              │  • Documents (bytea)   │
              │  • Versions (snapshots)│
              │  • Collaborators (RBAC)│
              └────────────────────────┘
```

### Data Flow

1. **User types** → TipTap applies the edit to the in-memory Yjs document (zero network latency).
2. **IndexedDB** persists the Yjs state locally for offline durability.
3. **HocuspocusProvider** sends Yjs update deltas over WebSocket to the collaboration server.
4. **Hocuspocus server** broadcasts the deltas to all connected clients and periodically persists the merged state to PostgreSQL.
5. **On reconnect**, Yjs state vectors are exchanged — only missing updates are transferred, achieving efficient differential sync.

### Conflict Resolution

Yjs implements an academic-grade CRDT (Conflict-free Replicated Data Type). Every character insertion receives a globally unique Lamport timestamp. When two users edit the same paragraph concurrently (even offline), the merge is:

- **Deterministic** — Same result regardless of operation arrival order.
- **Commutative** — `merge(A, B) === merge(B, A)`.
- **Idempotent** — Applying the same update twice has no effect.

This eliminates the need for manual conflict resolution dialogs entirely.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Editor | TipTap 3 + Yjs CRDT + y-indexeddb |
| Real-Time | Hocuspocus WebSocket Server |
| Database | PostgreSQL (Neon Serverless) + Drizzle ORM |
| Authentication | Auth.js v5 (JWT strategy, bcryptjs hashing) |
| AI | Groq LLM (llama-3.3-70b-versatile) |
| Validation | Zod v4 |
| Deployment | Vercel (frontend) + Railway (WebSocket server) |

---

## Security Design

### Authentication
- Passwords hashed with `bcryptjs` (10 salt rounds).
- JWT session strategy with `AUTH_SECRET` signing.
- Middleware protects all routes — unauthenticated users are redirected to `/login`.

### Authorization (RBAC)
- Three document roles: `owner`, `editor`, `viewer`.
- Hocuspocus server sets `connectionConfig.readOnly = true` for viewers — state update packets are rejected at the protocol level.
- Every API route verifies the user's role via a `documentCollaborators` JOIN query scoped to `session.user.id`.

### Tenant Isolation
- All database queries are scoped through Drizzle ORM with `WHERE userId = session.user.id` — there are no global table reads.
- Users can only access documents where they have an explicit `documentCollaborators` entry.

### OOM Prevention
- Sync payloads are capped at **1 MB** (`MAX_PAYLOAD_SIZE`). Oversized states are rejected before database writes.
- WebSocket connections require a valid, short-lived JWT (5 minute expiry) — unauthenticated clients are rejected at handshake.
- Zod validates all API request bodies to prevent malformed input.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (e.g., [Neon](https://neon.tech))

### Installation

```bash
git clone https://github.com/rishiksinha59/edgedocs.git
cd edgedocs
npm install
```

### Environment Variables

Create `.env.local` in the project root:

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://...

# Auth.js
AUTH_SECRET=<generate with: openssl rand -base64 32>
AUTH_URL=http://localhost:3000

# WebSocket Collaboration Server
NEXT_PUBLIC_COLLABORATION_URL=ws://localhost:1234

# Collaboration Server JWT Secret
COLLABORATION_JWT_SECRET=<generate with: openssl rand -base64 32>

# AI (Groq)
GROQ_API_KEY=<your groq api key>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Database Setup

```bash
npm run db:push
```

### Run Development Servers

```bash
# Terminal 1 — Next.js frontend
npm run dev

# Terminal 2 — Hocuspocus collaboration server
npm run dev:collab
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
edgedocs/
├── src/
│   ├── app/
│   │   ├── (auth)/           # Login & Register pages
│   │   ├── (dashboard)/      # Document list dashboard
│   │   ├── api/              # REST API routes
│   │   │   ├── ai/           # AI endpoints (complete, improve, summarize)
│   │   │   ├── auth/         # NextAuth handlers
│   │   │   └── documents/    # CRUD, versions, collaborators, sync
│   │   └── editor/           # Document editor page
│   ├── components/
│   │   ├── editor/           # EditorRoot, Toolbar, AI Assistant, Version Panel
│   │   └── ui/               # Button, Card, Input, ConfirmDialog, InputDialog
│   ├── hooks/                # useSyncEngine, useOnlineStatus
│   ├── lib/
│   │   ├── auth.ts           # Auth.js configuration
│   │   ├── db/               # Drizzle schema & connection
│   │   └── utils.ts          # Shared utilities
│   └── middleware.ts         # Route protection
├── server/                   # Hocuspocus collaboration server
│   ├── src/index.ts          # WebSocket server with JWT auth & RBAC
│   └── Dockerfile            # Production container
└── drizzle/                  # Database migrations
```

---

## Deployment

### Frontend (Vercel)
The Next.js frontend auto-deploys to Vercel on every push to `main`.

### Collaboration Server (Railway)
The Hocuspocus WebSocket server runs in a Docker container on Railway with the same `DATABASE_URL` and `COLLABORATION_JWT_SECRET` environment variables.

---

## Testing & Quality Assurance

EdgeDocs utilizes **Vitest** for unit and integration testing. The test suite contains **107 passing tests** verifying the core local-first capabilities, schema safety, API contracts, and conflict resolution engine.

### Running Tests Locally

Run the full test suite locally:
```bash
npm run test
```

Generate the unit test coverage report:
```bash
npm run test:coverage
```

### Coverage Report

The core business logic under `src/lib/` currently holds **100% Statement, Branch, Function, and Line Coverage**:

```text
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------|---------|----------|---------|---------|-------------------
All files        |     100 |      100 |     100 |     100 |                   
 lib             |     100 |      100 |     100 |     100 |                   
  config.ts      |     100 |      100 |     100 |     100 |                   
  errors.ts      |     100 |      100 |     100 |     100 |                   
  format.ts      |     100 |      100 |     100 |     100 |                   
  rate-limit.ts  |     100 |      100 |     100 |     100 |                   
  utils.ts       |     100 |      100 |     100 |     100 |                   
 lib/validations |     100 |      100 |     100 |     100 |                   
  auth.ts        |     100 |      100 |     100 |     100 |                   
  document.ts    |     100 |      100 |     100 |     100 |                   
-----------------|---------|----------|---------|---------|-------------------
```

### Automated CI/CD Testing
A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every commit. It validates the following steps automatically:
1. Installs clean dependencies.
2. Performs strict TypeScript compilation check (`tsc --noEmit`).
3. Runs the test suite with coverage (`npm run test:coverage`).
4. Uploads coverage HTML report logs as artifacts.
5. Builds the production Next.js application bundles.

---

## Author

**Rishik Sinha**
- GitHub: [github.com/rishiksinha59](https://github.com/rishiksinha59)
- LinkedIn: [linkedin.com/in/rishik-sinha-61a718287](https://www.linkedin.com/in/rishik-sinha-61a718287/)
