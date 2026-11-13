import { chromium } from "playwright-core";
// Browser walkthrough of the main flows against a running app with freshly seeded data.
// Usage: npm run build && npm start, then in another shell: BASE=http://localhost:3000 CHROME_PATH=/path/to/chrome npm run e2e
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE || "http://localhost:3000";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "screenshots");
const SAMPLES = path.join(ROOT, "samples");
const log = (...a) => console.log("✔", ...a);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`));

async function loginAs(name) {
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.waitForURL(`${BASE}/`);
}

// 1. Login as Alice
await loginAs("Alice");
await page.screenshot({ path: `${SHOTS}/01-login-home.png` });
log("Alice logged in, sees", await page.locator(".doc-row").count(), "owned docs");

// 2. Create doc, rename, format
await page.getByRole("button", { name: /New document/ }).click();
await page.waitForURL(/\/docs\//);
const docUrl = page.url();
await page.getByLabel("Document title").fill("Launch plan");
const ed = page.locator(".ProseMirror");
await ed.click();
await page.getByRole("button", { name: "Heading 1" }).click();
await page.keyboard.type("Launch plan");
await page.keyboard.press("Enter");
await page.keyboard.type("This is ");
await page.keyboard.press("Control+b");
await page.keyboard.type("bold");
await page.keyboard.press("Control+b");
await page.keyboard.type(", ");
await page.keyboard.press("Control+i");
await page.keyboard.type("italic");
await page.keyboard.press("Control+i");
await page.keyboard.type(" and ");
await page.keyboard.press("Control+u");
await page.keyboard.type("underlined");
await page.keyboard.press("Control+u");
await page.keyboard.press("Enter");
await page.getByRole("button", { name: "Bulleted list" }).click();
await page.keyboard.type("First bullet");
await page.keyboard.press("Enter");
await page.keyboard.type("Second bullet");
await page.keyboard.press("Enter");
await page.keyboard.press("Enter");
await page.getByRole("button", { name: "Numbered list" }).click();
await page.keyboard.type("Step one");
await page.waitForSelector("text=All changes saved", { timeout: 10000 });
await page.screenshot({ path: `${SHOTS}/02-editor-formatting.png` });
log("created + formatted + autosaved");

// 3. Reload and verify persistence
await page.reload();
await page.waitForSelector(".ProseMirror h1");
const html = await ed.innerHTML();
for (const t of ["<h1>Launch plan</h1>", "<strong>bold</strong>", "<em>italic</em>", "<u>underlined</u>", "<ul>", "<ol>"]) {
  if (!html.includes(t)) throw new Error(`missing after reload: ${t}\n${html}`);
}
if ((await page.getByLabel("Document title").inputValue()) !== "Launch plan") throw new Error("title not persisted");
log("formatting + title persisted after reload");

// 4. Share with Carol as viewer and Bob as editor
await page.getByRole("button", { name: "Share", exact: true }).click();
await page.getByLabel("Email to share with").fill("carol@ajaia.test");
await page.getByLabel("Access level").selectOption("viewer");
await page.locator(".share-form button").click();
await page.waitForSelector(".share-list >> text=Carol Diaz");
await page.getByLabel("Email to share with").fill("nobody@ajaia.test");
await page.locator(".share-form button").click();
await page.waitForSelector(".dialog .alert-error");
log("unknown email error:", await page.locator(".dialog .alert-error").innerText());
await page.screenshot({ path: `${SHOTS}/03-share-dialog.png` });
await page.getByRole("button", { name: "Done" }).click();

// 5. Upload a markdown file and a docx file, plus a bad type
await page.goto(BASE);
await page.setInputFiles('[data-testid="file-input"]', path.join(SAMPLES, "meeting-notes.md"));
await page.waitForURL(/\/docs\//);
await page.waitForSelector(".ProseMirror h1");
await page.screenshot({ path: `${SHOTS}/04-imported-markdown.png` });
log("md import →", await page.getByLabel("Document title").inputValue());
await page.goto(BASE);
await page.setInputFiles('[data-testid="file-input"]', path.join(SAMPLES, "sample.docx"));
await page.waitForURL(/\/docs\//);
await page.waitForSelector(".ProseMirror li");
log("docx import →", await page.getByLabel("Document title").inputValue());
await page.goto(BASE);
await page.setInputFiles('[data-testid="file-input"]', { name: "pic.png", mimeType: "image/png", buffer: Buffer.from("x") });
await page.waitForSelector(".alert-error");
log("bad upload error:", await page.locator(".alert-error").innerText());
await page.screenshot({ path: `${SHOTS}/05-home-owned.png` });

// 6. Switch to Carol: shared tab, read only
await page.getByRole("button", { name: "Switch user" }).click();
await page.waitForURL(/\/login/);
await loginAs("Carol");
await page.getByRole("tab", { name: /Shared with me/ }).click();
await page.screenshot({ path: `${SHOTS}/06-carol-shared-tab.png` });
await page.getByRole("link", { name: "Launch plan" }).click();
await page.waitForSelector(".ProseMirror h1");
const editable = await ed.getAttribute("contenteditable");
const toolbar = await page.locator(".toolbar").count();
if (editable !== "false" || toolbar !== 0) throw new Error("viewer should be read only");
await page.screenshot({ path: `${SHOTS}/07-carol-view-only.png` });
log("Carol sees doc as view only");

// 7. Bob (editor on welcome doc) can edit it
await page.getByRole("button", { name: "Switch user" }).click();
await loginAs("Bob");
await page.getByRole("tab", { name: /Shared with me/ }).click();
await page.getByRole("link", { name: "Welcome to Ajaia Docs" }).click();
await page.waitForSelector(".toolbar");
await ed.click();
await page.keyboard.press("Control+End");
await page.keyboard.press("Enter");
await page.keyboard.type("Bob was here.");
await page.waitForSelector("text=All changes saved", { timeout: 10000 });
await page.screenshot({ path: `${SHOTS}/08-bob-editor.png` });
log("Bob edited shared doc");

// 8. Bob cannot open Alice's private doc
await page.goto(docUrl);
await page.waitForSelector("text=Document not available");
log("Bob blocked from unshared doc");

// 9. Conflict detection: two tabs as Bob on the welcome doc
const welcome = (await page.goto(BASE), await page.getByRole("tab", { name: /Shared with me/ }).click(), await page.getByRole("link", { name: "Welcome to Ajaia Docs" }).getAttribute("href"));
const p2 = await ctx.newPage();
await page.goto(BASE + welcome);
await p2.goto(BASE + welcome);
await page.locator(".ProseMirror").click();
await page.keyboard.type(" tab1");
await page.waitForSelector("text=All changes saved");
await p2.locator(".ProseMirror").click();
await p2.keyboard.type(" tab2");
await p2.waitForSelector("text=Conflict", { timeout: 10000 });
await p2.screenshot({ path: `${SHOTS}/09-conflict.png` });
log("stale tab gets conflict banner");

console.log(errors.length ? `HTTP errors seen (expected: unknown-email share + bad upload):\n${errors.join("\n")}` : "No browser console errors");
await browser.close();
