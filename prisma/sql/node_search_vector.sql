-- Full-text search over Node.
--
-- `searchVector` is a STORED generated column, so Postgres recomputes it on
-- every insert/update automatically — no triggers or app-side bookkeeping. The
-- title is weighted 'A' (above) the body 'B' so title hits rank higher. The GIN
-- index makes `@@` lookups effectively O(matches) and stays fast well past 10k
-- docs.
--
-- Prisma db push cannot express a generated column, so this is applied out of
-- band via `prisma db execute`. It is idempotent and safe to re-run.

ALTER TABLE "Node"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("body", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "Node_searchVector_idx"
  ON "Node" USING GIN ("searchVector");
