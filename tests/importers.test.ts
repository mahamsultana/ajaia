import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ImportError, importFile, textToHtml, titleFromFilename } from "@/lib/importers";
import { sanitizeDocumentHtml } from "@/lib/sanitize";

describe("importFile", () => {
  it("turns plain text into paragraphs and escapes HTML", async () => {
    const res = await importFile("notes.txt", Buffer.from("Hello <b>world</b>\nline 2\n\nSecond"));
    expect(res.title).toBe("notes");
    expect(res.html).toBe("<p>Hello &lt;b&gt;world&lt;/b&gt;<br>line 2</p><p>Second</p>");
  });

  it("converts markdown headings, emphasis and lists", async () => {
    const md = "# Title\n\nSome **bold** and *italic*.\n\n- one\n- two\n\n1. first\n";
    const { html } = await importFile("plan.md", Buffer.from(md));
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toMatch(/<ul>\s*<li>one<\/li>/);
    expect(html).toContain("<ol>");
  });

  it("converts a real .docx file, keeping headings, bold and lists", async () => {
    const buf = fs.readFileSync(path.join(__dirname, "fixtures", "sample.docx"));
    const { title, html } = await importFile("Quarterly_Plan.docx", buf);
    expect(title).toBe("Quarterly Plan");
    expect(html).toContain("<h1>Quarterly Plan</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<li>Ship the editor</li>");
  });

  it("strips scripts and event handlers from imported markdown", async () => {
    const md = 'Hi <script>alert(1)</script><img src=x onerror="alert(2)"> [x](javascript:alert(3))';
    const { html } = await importFile("evil.md", Buffer.from(md));
    expect(html).not.toMatch(/script|onerror|javascript:|<img/i);
  });

  it("rejects unsupported, empty and corrupt files with a clear message", async () => {
    await expect(importFile("photo.png", Buffer.from("x"))).rejects.toThrow(/Unsupported file type ".png"/);
    await expect(importFile("empty.txt", Buffer.alloc(0))).rejects.toBeInstanceOf(ImportError);
    await expect(importFile("broken.docx", Buffer.from("not a zip"))).rejects.toBeInstanceOf(ImportError);
  });
});

describe("helpers", () => {
  it("derives a readable title from the filename", () => {
    expect(titleFromFilename("my_meeting-notes.md")).toBe("my meeting notes");
    expect(titleFromFilename(".md")).toBe("Imported document");
  });
  it("handles empty text", () => {
    expect(textToHtml("   ")).toBe("<p></p>");
  });
  it("sanitizer keeps editor formatting", () => {
    const html = "<h2>T</h2><p><strong>b</strong><em>i</em><u>u</u></p><ol><li>x</li></ol>";
    expect(sanitizeDocumentHtml(html)).toBe(html);
  });
});
