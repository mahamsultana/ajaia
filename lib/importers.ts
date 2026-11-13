import { marked } from "marked";
import { sanitizeDocumentHtml } from "./sanitize";

export const SUPPORTED_EXTENSIONS = [".txt", ".md", ".docx"] as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export class ImportError extends Error {}

export interface ImportedDocument {
  title: string;
  html: string;
}

function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i).toLowerCase();
}

export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return (base || "Imported document").slice(0, 200);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Plain text: blank lines separate paragraphs, single newlines become <br>. */
export function textToHtml(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "<p></p>";
  return normalized
    .split(/\n{2,}/)
    .map((para) => `<p>${para.split("\n").map(escapeHtml).join("<br>")}</p>`)
    .join("");
}

export function markdownToHtml(md: string): string {
  const html = marked.parse(md, { async: false, gfm: true }) as string;
  return sanitizeDocumentHtml(html);
}

async function docxToHtml(buffer: Buffer): Promise<string> {
  // Imported lazily so mammoth is only loaded when a .docx is uploaded.
  const mammoth = await import("mammoth");
  try {
    const result = await mammoth.convertToHtml({ buffer });
    return sanitizeDocumentHtml(result.value);
  } catch {
    throw new ImportError("Could not read this .docx file. Is it a valid Word document?");
  }
}

export async function importFile(filename: string, buffer: Buffer): Promise<ImportedDocument> {
  const ext = extensionOf(filename);
  if (!SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])) {
    throw new ImportError(
      `Unsupported file type "${ext || "none"}". Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`,
    );
  }
  if (buffer.byteLength === 0) throw new ImportError("The file is empty.");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) throw new ImportError("File is too large (max 5 MB).");

  let html: string;
  if (ext === ".docx") {
    html = await docxToHtml(buffer);
  } else {
    const text = buffer.toString("utf8");
    if (text.includes("\u0000")) throw new ImportError("This file does not look like text.");
    html = ext === ".md" ? markdownToHtml(text) : textToHtml(text);
  }

  return { title: titleFromFilename(filename), html: html || "<p></p>" };
}
