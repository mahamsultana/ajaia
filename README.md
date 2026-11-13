# Ajaia Docs

A lightweight collaborative document editor: create, format, import, share and reopen documents in the browser.

**Live app:** LIVE_URL_HERE
**Demo accounts** (no password, pick one on the login screen):

| User | Email | Seeded data |
|---|---|---|
| Alice Khan | alice@ajaia.test | Owns "Welcome to Ajaia Docs" |
| Bob Ahmed | bob@ajaia.test | Has editor access to Alice's welcome doc |
| Carol Diaz | carol@ajaia.test | Nothing yet, use her to test sharing |

## What works

1. **Documents**: create, rename (inline title), edit, autosave (800 ms debounce, Ctrl/Cmd+S saves now), reopen, delete (owner only).
2. **Rich text**: bold, italic, underline, H1/H2/H3, bulleted and numbered lists, quote, undo/redo. Stored as sanitized HTML so formatting survives reloads.
3. **File upload**: upload a **.txt, .md or .docx** file (max 5 MB) from the Documents page and it becomes a new editable document. Other types are rejected with a clear message.
4. **Sharing**: the owner shares by email with **Can edit** or **Can view** access, changes roles, or removes access. The list page separates **Owned by me** and **Shared with me**. Viewers get a read-only editor; people without access get a "not available" page (404, so ids can't be probed).
5. **Persistence**: Postgres. Documents, titles, formatting and shares survive refreshes and redeploys.
6. **Concurrent edit safety**: every save carries the version it was based on; a stale save is rejected (409) and the user is asked to reload instead of silently overwriting someone else's work.
7. **Stretch**: export any document to Markdown.

## Quick sharing test (2 minutes)

1. Log in as **Alice**, click **+ New document**, type something with formatting.
2. Click **Share**, enter `carol@ajaia.test`, pick **Can view**, click **Share**.
3. Click **Switch user**, log in as **Carol**, open the **Shared with me** tab. The doc is there and read only.
4. Switch to **Bob**: he can edit Alice's welcome doc but cannot open the doc Alice just made.

Sample files to upload are in `samples/` (`meeting-notes.md`, `plain.txt`, `sample.docx`).

## Run locally

Requirements: Node 18.18+ and a Postgres database (local or a free Neon branch).

```bash
npm install
cp .env.example .env          # then set DATABASE_URL and SESSION_SECRET
npm run db:setup              # creates tables + seeds demo users (safe to re-run)
npm run dev                   # http://localhost:3000
```

Postgres options for `DATABASE_URL`:

1. **Neon (no install)**: create a free project at neon.tech, copy the connection string.
2. **Docker**: `docker run -d --name ajaia-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ajaia_docs -p 5432:5432 postgres:16`, then `DATABASE_URL=postgres://postgres:postgres@localhost:5432/ajaia_docs`.

## Tests

```bash
npm test                                              # unit tests (access rules, importers, validation)
TEST_DATABASE_URL=postgres://... npm test             # also runs the Postgres integration test
npm run typecheck
```

The integration test (`tests/documents.integration.test.ts`) walks a full lifecycle against a real database: sanitize on create, stranger gets 404, viewer cannot edit, only the owner can share, editor saves, stale write gets 409, revoke removes access, owner deletes. Use an empty or throwaway database; it creates and removes its own `t_*` users.

## Deploy (Vercel + Neon, both free)

1. Create a Neon project and copy its **pooled** connection string.
2. Push this repo to GitHub and import it in Vercel (framework: Next.js, defaults are fine).
3. Add env vars in Vercel: `DATABASE_URL` (Neon string) and `SESSION_SECRET` (any long random string, e.g. `openssl rand -hex 32`).
4. Deploy. The `vercel-build` script runs `scripts/db-setup.mjs` before `next build`, so tables and demo users are created automatically.

## Project layout

```
app/                    Next.js App Router pages + API route handlers
  api/session           mock login / logout (signed cookie)
  api/documents         list, create, get, update (versioned), delete
  api/documents/import  .txt / .md / .docx upload -> new document
  api/documents/[id]/shares   share, change role, revoke
  api/documents/[id]/export   Markdown export
components/             Editor (TipTap), ShareDialog, DocumentList, TopBar
lib/access.ts           pure role + permission rules (unit tested)
lib/documents.ts        data access with access checks on every call
lib/importers.ts        file -> HTML conversion (marked, mammoth)
lib/sanitize.ts         HTML allowlist applied to every write
db/schema.sql           idempotent schema
scripts/db-setup.mjs    apply schema + seed demo data
tests/                  Vitest unit + integration tests
```

See `ARCHITECTURE.md` for decisions and tradeoffs, and `AI_WORKFLOW.md` for how AI tools were used.
