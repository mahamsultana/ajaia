import TurndownService from "turndown";
import { getDocumentForUser } from "@/lib/documents";
import { handle, requireUser } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

function safeFilename(title: string): string {
  return title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "document";
}

// Export a document as Markdown (stretch feature).
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const doc = await getDocumentForUser(params.id, user.id, "view");
  const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
  td.addRule("underline", { filter: ["u"], replacement: (c) => `<u>${c}</u>` });
  const body = td.turndown(doc.content || "");
  // Avoid a duplicate heading when the document already starts with an H1.
  const markdown = (doc.content.trimStart().startsWith("<h1") ? body : `# ${doc.title}\n\n${body}`) + "\n";
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename(doc.title)}.md"`,
    },
  });
});
