# Personal OS
An operating system built to capture, organize, and grow everything I learn.

## Tech Stack
- Next.js(React)
- TypeScript
- tRPC
- Prisma
- PostgreSQL (Neon)
- Blob - Cloudflare R2
- Auth - Better Auth
- Tailwind CSS
- shadcn/ui

Instead of scattered docs, everything I learn and build lives in one connected system: engineering, career, projects, and AI workflows, organized as searchable note trees. The whole app runs as a read-only showcase of my content until I sign in, so visitors can explore or interrogate it, but only I can edit.

## What it does

### Knowledge base
- **Hierarchical spaces & pages** — a node tree of folders (spaces) and notes (pages) across four hubs: Learnings, Career, Projects, and AI Workflows.
- **Markdown editing** — CodeMirror GFM editor with autosave, Vim mode, drag-and-drop images (cropped and stored on R2), and an AI "polish" pass that reformats rough notes into clean Markdown.
- **Hybrid search** — Postgres full-text (`tsvector` + GIN) with ranked, highlighted snippets and breadcrumbs, alongside semantic vector search (pgvector/HNSW) over per-note embeddings.
- **Live table of contents** — a sticky "On this page" outline generated from rendered headings, with active-section tracking.

### AI
- **Chat agent (RAG)** — ask questions and get answers grounded in the notes, with inline citations. A tool-calling agent decides how to retrieve (semantic search, keyword search, browse-by-topic, recent notes), streams its reasoning steps and sources live, and suggests follow-ups.
- **Self-syncing embeddings** — the vector index tracks your text automatically. Edit, add, or delete note content and it re-vectorizes on its own: a content hash detects real drift (so unchanged notes are skipped), changed notes have their chunks rebuilt, and a daily sweep self-heals anything a save missed. You can also trigger a re-index on demand for a single note.
- **Automatic diagrams** — a second agent runs concurrently and, when it helps, renders a Mermaid diagram as an interactive Excalidraw scene alongside the answer.
- **AI whiteboard (Draw)** — describe a change in plain language and the agent edits an Excalidraw canvas directly, streaming shape-level mutations you watch apply in real time.
- **Embeddable diagrams** — Excalidraw scenes are persisted and can be embedded inline in any note.

### Access & privacy
- **Single-owner, public showcase** — reads are scoped to my account and served to everyone; writes are owner-only.
- **Locked notes & sections** — personal subtrees are hidden from everyone but me across browse, search, and the AI's retrieval.

## Under the hood

A few details I'm proud of:

- **Drift-aware, self-healing sync** — nothing is queued on save; staleness is derived from the data (`embeddedAt` vs `updatedAt` + a content hash), so the embedder is idempotent, safe to re-run, and can't miss a change. A 2-minute quiet window collapses rapid autosaves into a single re-embed instead of one per keystroke.
- **Diversified retrieval** — semantic search pulls a wide candidate pool from the HNSW index, then re-selects in memory so results span the most relevant *notes* rather than being dominated by whichever one note has the most matching chunks — with no extra database round-trips.
- **Streaming everything** — chat, diagrams, and canvas edits all stream over tRPC async-generator procedures, so you see the agent's steps, sources, and shape mutations as they happen.
- **Privacy at read time** — content is indexed regardless of privacy, but locked notes and their entire subtree are excluded from every non-owner read (browse, full-text, and vector search), so nothing personal leaks through the AI.
- **Observability built in** — every AI turn (chat, embeds, formatting) is traced to Langfuse with token usage and timings.

## Tech stack

- **Framework** — Next.js (React), TypeScript
- **API** — tRPC (streaming procedures for live AI responses)
- **Data** — Prisma + PostgreSQL (Neon), with `pgvector` and full-text search
- **AI** — Vercel AI SDK (OpenAI), Langfuse for tracing
- **Background jobs** — Inngest (keeps note embeddings in sync)
- **Storage** — Cloudflare R2
- **Auth & billing** — Better Auth, Polar
- **UI** — Tailwind CSS, shadcn/ui

## Vision

A system that understands everything I've learned, built, and accomplished — turning a personal archive into intelligent workflows for learning, career growth, and productivity.
>>>>>>> Stashed changes
