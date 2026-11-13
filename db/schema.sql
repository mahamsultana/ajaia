-- Ajaia Docs schema. Idempotent: safe to run on every deploy.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL DEFAULT 'Untitled document',
  -- Sanitized HTML produced by the TipTap editor (or by an importer).
  content     TEXT NOT NULL DEFAULT '',
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Incremented on every write; used for optimistic concurrency control.
  version     INTEGER NOT NULL DEFAULT 1,
  -- Set when a document was created from an uploaded file.
  source_file TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_owner_idx ON documents(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS document_shares (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, user_id)
);

CREATE INDEX IF NOT EXISTS document_shares_user_idx ON document_shares(user_id);
