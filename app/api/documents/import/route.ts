import { NextResponse } from "next/server";
import { createDocument } from "@/lib/documents";
import { handle, HttpError, requireUser } from "@/lib/http";
import { ImportError, importFile } from "@/lib/importers";

export const runtime = "nodejs";

// Upload a .txt, .md or .docx file and turn it into a new editable document.
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Expected a multipart form upload.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a file to upload.");

  try {
    const imported = await importFile(file.name, Buffer.from(await file.arrayBuffer()));
    const doc = await createDocument(user.id, {
      title: imported.title,
      html: imported.html,
      sourceFile: file.name,
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    if (err instanceof ImportError) throw new HttpError(400, err.message);
    throw err;
  }
});
