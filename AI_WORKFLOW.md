# AI workflow note

## Tools used

1. **Claude (Anthropic)** as a pair programmer in an agentic coding session: scaffolding, first drafts of route handlers and components, test cases, and the docs drafts.
2. **Headless Chrome via Playwright** (scripted with AI help) to click through the real UI and capture screenshots.
3. My own review in the editor and browser for every change before keeping it.

## Where AI materially sped things up

1. **Boilerplate across layers**: Next.js route handlers, zod schemas, the TipTap toolbar and the share dialog. Roughly the first working version of each surface in minutes instead of an hour.
2. **Test cases I would have under-written**: XSS payloads for the sanitizer, the corrupt `.docx` case, and the full share lifecycle in the integration test.
3. **Scripted UI verification**: a Playwright script (`e2e/flow.mjs`) that logs in as three users and checks formatting persistence, imports, view-only mode, blocked access and the conflict banner.

## What I changed or rejected

1. **Rejected Prisma.** The first plan used Prisma; its engine binaries are downloaded during install and that failed in the build environment. For four tables, plain SQL with `pg` is simpler to review and removes a fragile build step, so I switched.
2. **Rejected the suggested Next.js version.** The initial install pinned Next 14.2.18, which npm flagged with a published security advisory; I moved to the patched 14.2.35.
3. **Fixed an editor focus bug before shipping**: the generated page wrapper re-focused the editor on every click, which fights ProseMirror's own cursor placement. Now only clicks on the empty page margin focus the editor.
4. **Adjusted Markdown export** so a document that already starts with an H1 doesn't get its title duplicated.
5. **Design calls I made rather than accepting defaults**: 404 (not 403) for documents you can't access; a `version` column so concurrent saves conflict instead of silently overwriting; one server-side sanitizer on every write limited to the editor's own tag set.
6. **Kept scope cuts**: real-time collaboration and comments were left out on purpose to protect the core flows within the timebox.

## How I verified correctness and reliability

1. **Unit tests** (Vitest): permission matrix, importers (.txt, .md, real .docx fixture, bad files), sanitizer, validation.
2. **Integration test against real Postgres**: create, sanitize, 404 for strangers, viewer blocked from saving, only owner shares, editor saves, stale write gets 409, revoke, delete.
3. **Browser run of the real build** (`npm run build && npm start` + `e2e/flow.mjs`): formatting and title survive reload, uploads produce correct docs, unsupported upload shows an error, Carol sees a read-only shared doc, Bob is blocked from a private doc, two tabs produce a conflict instead of overwriting. Screenshots in `screenshots/`.
4. **Type check and production build** (`tsc --noEmit`, `next build`) with no errors.
5. **Manual UX pass** on the screenshots: save status visibility, empty states, error messages that say what to do next.
