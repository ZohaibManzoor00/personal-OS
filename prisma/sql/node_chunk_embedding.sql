-- Vector embeddings for NodeChunk.
--
-- Mirrors prisma/sql/node_search_vector.sql: Prisma can't express the pgvector
-- `vector` type or an HNSW index, so the extension, the `embedding` column, and
-- its index are applied out of band via `prisma db execute`. Everything here is
-- idempotent and safe to re-run.
--
-- Apply AFTER `prisma db push` has created the "NodeChunk" table:
--   pnpm dlx prisma db execute --file prisma/sql/node_chunk_embedding.sql --schema prisma/schema.prisma

CREATE EXTENSION IF NOT EXISTS vector;

-- 1536 dims = OpenAI text-embedding-3-small. Changing the model/dimensions later
-- means dropping this column and re-embedding everything.
ALTER TABLE "NodeChunk"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- HNSW over cosine distance: good recall/latency at our scale with no training
-- step (unlike IVFFlat). Vector search orders by `embedding <=> query`.
CREATE INDEX IF NOT EXISTS "NodeChunk_embedding_idx"
  ON "NodeChunk" USING hnsw ("embedding" vector_cosine_ops);
