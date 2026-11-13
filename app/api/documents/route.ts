import { NextResponse } from "next/server";
import { createDocument, listDocumentsForUser } from "@/lib/documents";
import { handle, readJson, requireUser } from "@/lib/http";
import { createDocumentSchema } from "@/lib/validation";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireUser();
  const docs = await listDocumentsForUser(user.id);
  return NextResponse.json({
    owned: docs.filter((d) => d.role === "owner"),
    shared: docs.filter((d) => d.role !== "owner"),
  });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = createDocumentSchema.parse(await readJson(req));
  const doc = await createDocument(user.id, { title: body.title });
  return NextResponse.json(doc, { status: 201 });
});
