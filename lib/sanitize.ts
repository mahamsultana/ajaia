import sanitizeHtml from "sanitize-html";

// Allowlist matches what the editor can produce. Anything else (scripts, styles,
// images, iframes, inline event handlers) is stripped before it reaches the DB.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h1", "h2", "h3", "strong", "b", "em", "i", "u", "s",
    "ul", "ol", "li", "blockquote", "code", "pre", "hr", "a",
  ],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    // Imported .docx/.md files can carry h4-h6; map them into the editor's range.
    h4: "h3",
    h5: "h3",
    h6: "h3",
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
};

export function sanitizeDocumentHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}
