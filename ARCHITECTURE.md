# Architecture note

## Goal for the timebox

Ship one coherent slice that works end to end and is safe to share: write a document, import one, share it with clear roles, and trust that nothing is lost or leaked. I chose depth in **editing, access control and save reliability** over breadth (no real-time co-editing, comments or real auth).

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 14 (App Router), TypeScript | One deployable unit for UI and API; server components load data with no client fetch waterfall. |
| Editor | TipTap (ProseMirror) | Mature rich-text model, keyboard shortcuts and undo for free; easy to restrict to the formats we support. |
| Storage | Postgres via `pg` (Neon in production) | Relational fit for owners and shares, free hosted tier, survives redeploys (unlike SQLite on serverless). |
| Validation | zod | Request validation in one place with readable error messages. |
| Import | `marked` (Markdown), `mammoth` (.docx) | Both produce HTML that flows straight into the editor's format. |
| Tests | Vitest | Fast, TypeScript native. |

I used plain SQL rather than an ORM: four queries' worth of schema doesn't need one, the SQL is easy to review, and it avoids native engine downloads during the build.

## Data model

```
users(id, email, name)
documents(id uuid, title, content html, owner_id -> users, version int, source_file, timestamps)
document_shares(document_id, user_id, role in ('viewer','editor'))   PK (document_id, user_id)
```

Ownership is a column, not a share row, so a document always has exactly one owner and "owned vs shared" is a simple query.

## Key decisions

1. **Content stored as sanitized HTML.** It is what TipTap reads and writes, so formatting round-trips exactly. Every write (editor saves and imports) passes through one allowlist (`lib/sanitize.ts`) that only keeps the tags the editor can produce. This blocks stored XSS from crafted API calls or malicious uploads. The tradeoff vs. ProseMirror JSON: HTML is a little less structured, but it is portable (export, import) and readable in the DB.

2. **Access rules are pure functions** (`lib/access.ts`): `resolveRole` and `can(role, action)`. Every data function in `lib/documents.ts` calls them, so no route can forget a check. Owner: everything. Editor: view, edit, rename. Viewer: view. Only owners share or delete.

3. **404 instead of 403 for no access.** Someone without access can't tell whether a document id exists. 403 is used only when you can see a doc but the action is above your role (e.g. a viewer trying to save).

4. **Optimistic concurrency with a version column.** Autosave sends the version it started from; the `UPDATE ... WHERE version = $n` only applies if nobody saved in between. Otherwise the client shows a conflict banner and stops saving. This is cheap and prevents the worst failure for a shared editor (silent data loss) without building real-time sync.

5. **Autosave UX.** Debounced 800 ms, one request in flight at a time, failed changes are kept and retried, Ctrl/Cmd+S saves now, the browser warns before leaving with unsaved changes, and a status label shows Saved / Saving / Not saved.

6. **Mock auth with a signed cookie.** Users pick a seeded account; the user id is stored in an HMAC-signed, httpOnly cookie so it can't be edited by hand. Real auth would replace only `lib/session.ts` and the login page.

7. **Upload creates a new document.** The most useful import behaviour for a docs tool. Supported types are stated in the UI and README; unsupported, empty, oversized (5 MB) and corrupt files return clear errors.

## Deliberately not built

1. Real-time co-editing and presence (would need CRDT/Yjs and a websocket service; the version check covers safety instead).
2. Real authentication, invitations for users who don't exist yet, link sharing.
3. Comments, suggestions, version history.
4. Images, tables, fonts, colors in the editor.
5. Attachments stored alongside a document (import covers the upload requirement with less storage infrastructure).

## Next 2 to 4 hours

1. Version history: store a snapshot row per save batch, add a "restore" view.
2. Real-time presence indicators ("Bob is viewing") via polling or a lightweight websocket.
3. Real auth (NextAuth email magic link) and pending invites by email.
4. Playwright e2e test in CI for the share flow; rate limiting on upload.
