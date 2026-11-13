// Creates tables (idempotent) and seeds demo users plus one welcome document.
// Usage: DATABASE_URL=... npm run db:setup
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));

// Load .env / .env.local for local runs (Vercel injects env vars directly).
for (const file of [".env.local", ".env"]) {
  const p = path.join(here, "..", file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const USERS = [
  { id: "u_alice", email: "alice@ajaia.test", name: "Alice Khan" },
  { id: "u_bob", email: "bob@ajaia.test", name: "Bob Ahmed" },
  { id: "u_carol", email: "carol@ajaia.test", name: "Carol Diaz" },
];

const WELCOME_HTML = `<h1>Welcome to Ajaia Docs</h1>
<p>This document is owned by <strong>Alice</strong> and shared with <strong>Bob</strong> as an <em>editor</em>.</p>
<h2>Try these</h2>
<ul><li>Format text with <strong>bold</strong>, <em>italic</em> and <u>underline</u></li><li>Use the H1 / H2 / H3 buttons for headings</li><li>Switch user (top right) to see the shared view</li></ul>
<ol><li>Create a document</li><li>Share it with Carol as a viewer</li><li>Log in as Carol and confirm it is read only</li></ol>`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const schema = fs.readFileSync(path.join(here, "..", "db", "schema.sql"), "utf8");
  await client.query(schema);
  console.log("Schema applied.");

  for (const u of USERS) {
    await client.query(
      `INSERT INTO users (id, email, name) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name`,
      [u.id, u.email, u.name],
    );
  }
  console.log(`Seeded ${USERS.length} users.`);

  const existing = await client.query(
    `SELECT 1 FROM documents WHERE owner_id = 'u_alice' AND title = 'Welcome to Ajaia Docs' LIMIT 1`,
  );
  if (existing.rowCount === 0) {
    const { rows } = await client.query(
      `INSERT INTO documents (title, content, owner_id) VALUES ($1, $2, 'u_alice') RETURNING id`,
      ["Welcome to Ajaia Docs", WELCOME_HTML],
    );
    await client.query(
      `INSERT INTO document_shares (document_id, user_id, role) VALUES ($1, 'u_bob', 'editor')`,
      [rows[0].id],
    );
    console.log("Seeded welcome document (owned by Alice, shared with Bob as editor).");
  }
} finally {
  await client.end();
}
