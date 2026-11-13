import { chromium } from "playwright-core";
// Records a paced, captioned walkthrough of the main flows in a visible Chrome window.
// Usage (app running, freshly seeded DB):
//   BASE=http://localhost:3000 CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" OUT_DIR=../demo-video node e2e/record-demo.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE || "http://localhost:3000";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.resolve(ROOT, process.env.OUT_DIR || "../demo-video");
const SAMPLES = path.join(ROOT, "samples");
const W = 1280, H = 800;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: false,
  args: [`--window-size=${W},${H + 140}`],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: OUT_DIR, size: { width: W, height: H } },
});

// Fake cursor + click ripple + caption bar, re-injected on every page load.
await ctx.addInitScript(() => {
  const install = () => {
    if (document.getElementById("__demo_cursor")) return;
    const style = document.createElement("style");
    style.textContent = `
      #__demo_cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
        background:rgba(255,90,31,.35);border:2.5px solid #ff5a1f;z-index:2147483647;pointer-events:none;
        transition:transform .12s ease}
      #__demo_cursor.down{transform:scale(.7);background:rgba(255,90,31,.6)}
      .__ripple{position:fixed;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;border:3px solid #ff5a1f;
        z-index:2147483646;pointer-events:none;animation:__rip .5s ease-out forwards}
      @keyframes __rip{to{transform:scale(4.5);opacity:0}}
      #__demo_caption{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483645;pointer-events:none;
        background:#141210;color:#f3ede1;font:600 17px/1.35 system-ui,sans-serif;padding:11px 20px;border-radius:12px;
        border:2px solid #d4f53c;box-shadow:4px 4px 0 #d4f53c;max-width:86vw;text-align:center;opacity:0;transition:opacity .25s}
      #__demo_caption.on{opacity:1}
      #__demo_caption b{color:#d4f53c}`;
    document.head.appendChild(style);
    const c = document.createElement("div");
    c.id = "__demo_cursor";
    const pos = window.__demoPos || { x: -50, y: -50 };
    c.style.left = pos.x + "px"; c.style.top = pos.y + "px";
    document.body.appendChild(c);
    const cap = document.createElement("div");
    cap.id = "__demo_caption";
    document.body.appendChild(cap);
    window.addEventListener("mousemove", (e) => {
      c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px";
      window.__demoPos = { x: e.clientX, y: e.clientY };
    }, true);
    window.addEventListener("mousedown", (e) => {
      c.classList.add("down");
      const r = document.createElement("div");
      r.className = "__ripple"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
      document.body.appendChild(r); setTimeout(() => r.remove(), 600);
    }, true);
    window.addEventListener("mouseup", () => c.classList.remove("down"), true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
});

const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);
let mouse = { x: W / 2, y: H / 2 };

const PACE = Number(process.env.PACE || 1.35); // stretch caption holds so there's room to narrate

async function caption(html, hold = 0) {
  await page.waitForSelector("#__demo_caption", { state: "attached" });
  await page.evaluate((h) => {
    const el = document.getElementById("__demo_caption");
    el.innerHTML = h; el.classList.toggle("on", !!h);
  }, html);
  if (hold) await wait(hold * PACE);
}

/** Full-screen summary card for the closing section of the video. */
async function card(title, items, hold) {
  await page.evaluate(({ title, items }) => {
    document.getElementById("__demo_caption")?.classList.remove("on");
    let el = document.getElementById("__demo_card");
    if (!el) {
      el = document.createElement("div");
      el.id = "__demo_card";
      el.style.cssText = "position:fixed;inset:0;z-index:2147483640;background:#141210;color:#f3ede1;display:flex;flex-direction:column;justify-content:center;padding:0 110px;font-family:var(--font-body),system-ui,sans-serif";
      document.body.appendChild(el);
    }
    el.innerHTML =
      `<div style="font:700 14px/1 system-ui;letter-spacing:.14em;text-transform:uppercase;color:#ff5a1f;margin-bottom:14px">Ajaia Docs</div>` +
      `<h1 style="font-family:var(--font-display),system-ui;font-size:52px;line-height:1;letter-spacing:-.03em;margin:0 0 30px">${title}</h1>` +
      `<ul style="list-style:none;margin:0;padding:0;display:grid;gap:14px">` +
      items.map((t) => `<li style="font-size:21px;line-height:1.4;display:flex;gap:14px"><span style="color:#d4f53c;font-weight:800">→</span><span>${t}</span></li>`).join("") +
      `</ul>`;
  }, { title, items });
  await wait(hold);
}

/** Glide the cursor to an element, then click it. */
async function click(locator, { pause = 350 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 22 });
  mouse = { x, y };
  await wait(pause);
  await locator.click();
}

async function hover(locator, ms = 900) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, { steps: 22 });
  await wait(ms);
}

/** Human-paced typing: uneven delays per key, small pauses after spaces and punctuation. */
async function type(text) {
  for (const ch of text) {
    await page.keyboard.type(ch);
    let d = 70 + Math.random() * 90;
    if (ch === " ") d += Math.random() * 80;
    if (/[.,:]/.test(ch)) d += 150 + Math.random() * 150;
    await wait(d);
  }
}
const tb = (name) => click(page.getByRole("button", { name, exact: true }), { pause: 200 });

async function loginAs(name) {
  await page.goto(`${BASE}/login`);
  await caption(`Demo login: three seeded accounts, <b>no password</b>`, 1800);
  await click(page.getByRole("button", { name: new RegExp(name) }));
  await page.waitForURL(`${BASE}/`);
}

async function switchUser(name) {
  await click(page.getByRole("button", { name: /Switch user/ }));
  await page.waitForURL(/\/login/);
  await loginAs(name);
}

// ---------------------------------------------------------------- 1. Login
await page.goto(`${BASE}/login`);
await page.mouse.move(mouse.x, mouse.y);
await caption(`<b>Ajaia Docs</b>: a lightweight collaborative document editor`, 3200);
await loginAs("Alice");
await caption(`Signed in as <b>Alice</b>. Owned and shared documents live in separate tabs`, 3000);

// ---------------------------------------------------------------- 2. Create + format
await caption(`Create a new document`);
await click(page.getByRole("button", { name: /New document/ }));
await page.waitForURL(/\/docs\//);
await wait(700);

await caption(`Rename it inline. The title autosaves`);
const title = page.getByLabel("Document title");
await click(title);
await page.keyboard.press("Control+A");
await type("Q4 Launch Plan");
await wait(800);

await caption(`Rich text: headings, <b>bold</b>, <i>italic</i>, <u>underline</u>, lists`);
await click(page.locator(".ProseMirror"));
await tb("Heading 1");
await type("Q4 Launch Plan");
await page.keyboard.press("Enter");
await type("This plan covers ");
await tb("Bold (Ctrl+B)"); await type("scope"); await tb("Bold (Ctrl+B)");
await type(", ");
await tb("Italic (Ctrl+I)"); await type("timeline"); await tb("Italic (Ctrl+I)");
await type(" and ");
await tb("Underline (Ctrl+U)"); await type("owners"); await tb("Underline (Ctrl+U)");
await type(".");
await page.keyboard.press("Enter");
await tb("Heading 2");
await type("Goals");
await page.keyboard.press("Enter");
await tb("Bulleted list");
await type("Ship the shared editor to two pilot teams");
await page.keyboard.press("Enter");
await type("Cut document setup time in half");
await page.keyboard.press("Enter");
await page.keyboard.press("Enter");
await tb("Heading 2");
await type("Next steps");
await page.keyboard.press("Enter");
await tb("Numbered list");
await type("Finalise scope with design");
await page.keyboard.press("Enter");
await type("QA sign-off");
await page.keyboard.press("Enter");
await type("Launch review");
await page.waitForSelector("text=All changes saved", { timeout: 10000 });
await hover(page.locator(".save-status"), 400);
await caption(`Autosaves as you type: note the <b>All changes saved</b> status`, 2600);

// ---------------------------------------------------------------- 3. Persistence
await caption(`Refresh the page: content, formatting and title all persist (Postgres)`);
await wait(1200);
await page.reload();
await page.waitForSelector(".ProseMirror h1");
await caption(`Refresh the page: content, formatting and title all persist (Postgres)`, 2800);

// ---------------------------------------------------------------- 4. Sharing
await caption(`Only the <b>owner</b> can share. Invite by email with a role`);
await click(page.getByRole("button", { name: "Share", exact: true }));
await wait(600);
const email = page.getByLabel("Email to share with");
await click(email);
await type("carol@ajaia.test");
await page.getByLabel("Access level").selectOption("viewer");
await wait(500);
await click(page.locator(".share-form button"));
await page.waitForSelector(".share-list >> text=Carol Diaz");
await caption(`Carol gets <b>Can view</b>, Bob gets <b>Can edit</b>`, 900);
await click(email);
await type("bob@ajaia.test");
await page.getByLabel("Access level").selectOption("editor");
await wait(400);
await click(page.locator(".share-form button"));
await page.waitForSelector(".share-list >> text=Bob Ahmed");
await wait(1200);
await caption(`Validation: unknown users get a clear error`);
await click(email);
await type("nobody@ajaia.test");
await click(page.locator(".share-form button"));
await page.waitForSelector(".dialog .alert-error");
await wait(2400);
await page.getByLabel("Email to share with").fill("");
await click(page.getByRole("button", { name: "Done" }));

// ---------------------------------------------------------------- 5. List
await click(page.getByRole("link", { name: "Back to documents" }));
await page.waitForURL(`${BASE}/`);
await caption(`The list shows who each document is shared with, or <b>Private</b>`, 1500);
await hover(page.locator(".doc-row").first(), 1800);

// ---------------------------------------------------------------- 6. Upload
await caption(`Upload a <b>.md</b>, <b>.txt</b> or <b>.docx</b> file to turn it into an editable document`, 2200);
await page.setInputFiles('[data-testid="file-input"]', path.join(SAMPLES, "meeting-notes.md"));
await page.waitForURL(/\/docs\//);
const privateDocUrl = page.url();
await caption(`Markdown headings, lists and emphasis are converted to rich text`, 3200);
await page.mouse.wheel(0, 300); await wait(900); await page.mouse.wheel(0, -300);
await click(page.getByRole("link", { name: "Back to documents" }));
await page.waitForURL(`${BASE}/`);
await page.setInputFiles('[data-testid="file-input"]', path.join(SAMPLES, "sample.docx"));
await page.waitForURL(/\/docs\//);
await caption(`Word <b>.docx</b> works too, with headings, bold and lists kept`, 3000);
await click(page.getByRole("link", { name: "Back to documents" }));
await page.waitForURL(`${BASE}/`);
await caption(`Unsupported files are rejected with a helpful message`);
await page.setInputFiles('[data-testid="file-input"]', { name: "photo.png", mimeType: "image/png", buffer: Buffer.from("x") });
await page.waitForSelector(".alert-error");
await wait(2600);
await click(page.getByRole("button", { name: "Dismiss" }));

// ---------------------------------------------------------------- 7. Carol: viewer
await switchUser("Carol");
await caption(`<b>Carol</b> finds the doc under <b>Shared with me</b>`);
await click(page.getByRole("tab", { name: /Shared with me/ }));
await wait(1600);
await click(page.getByRole("link", { name: "Q4 Launch Plan" }));
await page.waitForSelector(".ProseMirror");
await caption(`Viewers get a read-only document: no toolbar, no editing, no share button`, 3600);

// ---------------------------------------------------------------- 8. Bob: editor
await switchUser("Bob");
await click(page.getByRole("tab", { name: /Shared with me/ }));
await wait(900);
await click(page.getByRole("link", { name: "Q4 Launch Plan" }));
await page.waitForSelector(".toolbar");
await caption(`<b>Bob</b> is an editor, so he can make changes, which autosave`);
await wait(3000); // let the editor finish initialising before placing the cursor
await click(page.locator(".ProseMirror").getByText("Launch review", { exact: true }));
await wait(400);
await page.keyboard.press("Control+End");
await wait(400);
await page.keyboard.press("Enter");
await type("Bob: book the launch review room");
await page.waitForSelector("text=All changes saved", { timeout: 10000 });
await wait(2200);

// ---------------------------------------------------------------- 9. Access control
await caption(`Bob opens a link to a document that was <b>not</b> shared with him…`, 1800);
await page.goto(privateDocUrl);
await page.waitForSelector("text=Document not available");
await caption(`…and is blocked. The server returns 404, so document ids can't be probed`, 3600);

// ---------------------------------------------------------------- 10. Back to Alice
await click(page.getByRole("link", { name: "Back to documents" }));
await switchUser("Alice");
await click(page.getByRole("link", { name: "Q4 Launch Plan" }));
await page.waitForSelector(".ProseMirror");
await caption(`Back as <b>Alice</b>: Bob's edit is already here`, 1200);
await hover(page.locator(".ProseMirror li").last(), 2600);
await caption(`Export to Markdown is a one-click stretch feature`, 600);
await hover(page.getByTitle("Download as Markdown"), 2200);

// ---------------------------------------------------------------- 11. Conflict safety
await caption(`Safety net: suppose someone else saves this document in another tab…`, 2600);
await page.evaluate(async () => {
  // Simulate a save from elsewhere: same content, but it bumps the stored version.
  const id = location.pathname.split("/").pop();
  const doc = await (await fetch(`/api/documents/${id}`)).json();
  await fetch(`/api/documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: doc.title, version: doc.version }),
  });
});
await click(page.locator(".ProseMirror").getByText("Launch review", { exact: true }));
await page.keyboard.press("Control+End");
await type(" (moved to Friday)");
await page.waitForSelector("text=Conflict", { timeout: 10000 });
await caption(`…Alice's stale save is rejected (HTTP 409) instead of silently overwriting their work`, 4000);
await hover(page.getByRole("button", { name: "Reload" }), 1500);

// ---------------------------------------------------------------- 12. Closing cards
await card("What works end to end", [
  "Create, rename, rich-text edit, autosave, reopen, delete",
  "Upload .txt / .md / .docx into a new editable document",
  "Share by email as editor or viewer, change role, revoke",
  "Owned vs shared tabs, read-only viewers, 404 for no access",
  "Postgres persistence, conflict detection, Markdown export",
], 11000);
await card("Key decisions", [
  "One Next.js app + Postgres: a single deployable unit, free hosting",
  "Content stored as sanitized HTML: exact round-trip, XSS-safe",
  "Access rules are pure functions every data call goes through",
  "404 not 403, so document ids can't be probed",
  "Version column for optimistic concurrency instead of real-time sync",
], 13000);
await card("Deliberately deprioritized", [
  "Real-time co-editing and presence (needs CRDT + websockets)",
  "Real authentication: seeded accounts + signed cookie instead",
  "Comments, suggestions and version history",
  "Images, tables, fonts and colours in the editor",
], 11000);
await card("How AI supported the work", [
  "Claude as pair programmer: scaffolding, route handlers, tests, docs drafts",
  "Rejected: Prisma (fragile build), a Next.js version with a security advisory",
  "Fixed AI output: an editor focus bug, duplicate titles in Markdown export",
  "Verified with unit + Postgres integration tests and a scripted browser run",
], 13000);
await card("Next 2–4 hours", [
  "Version history with restore",
  "Presence indicators (“Bob is viewing”)",
  "Real auth with email invites",
  "Playwright e2e in CI, rate limiting on upload",
], 9000);
await card("Thanks for watching", ["Try it yourself: log in as Alice, Bob or Carol, no password needed"], 5000);

const video = page.video();
await ctx.close();
await browser.close();
console.log("VIDEO", await video.path());
