# Submission: Ajaia Docs

**Live app:** https://ajaia-three-theta.vercel.app/
**GitHub:** https://github.com/mahamsultana/ajaia
**Google Drive folder:** https://drive.google.com/drive/u/0/folders/1b0zGofpnPNrrq4tgpspS4mzE0gnUQNux
**Walkthrough video:** VIDEO_URL_HERE (also in `VIDEO_URL.txt`)

## Test accounts (no password, pick on the login screen)

1. Alice Khan, alice@ajaia.test: owns "Welcome to Ajaia Docs"
2. Bob Ahmed, bob@ajaia.test: editor on Alice's welcome doc
3. Carol Diaz, carol@ajaia.test: no access yet, use her to test sharing

## What is included

| Item | Location |
|---|---|
| Source code | `app/`, `components/`, `lib/`, `db/`, `scripts/` |
| Setup and run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| Automated tests | `tests/` (unit + Postgres integration), `e2e/flow.mjs` (browser flow) |
| Video link | `VIDEO_URL.txt` |
| Screenshots | `screenshots/` |
| Sample upload files | `samples/` (.md, .txt, .docx) |
| Env template | `.env.example` |
| License (evaluation use only) | `LICENSE` |

## Status

**Working end to end:** create, rename, rich-text edit, autosave, reopen, delete; .txt/.md/.docx upload into a new document; owner shares by email as editor or viewer, change role, revoke; owned vs shared tabs; read-only view for viewers; access denied for others; Postgres persistence; conflict detection on concurrent saves; Markdown export (stretch).

**Incomplete / intentionally cut:** real-time co-editing and presence, real authentication, comments, version history, images and tables in the editor, attachments stored on a document.

**Next 2 to 4 hours:** version history with restore, presence indicators, real auth with email invites, Playwright e2e in CI.
