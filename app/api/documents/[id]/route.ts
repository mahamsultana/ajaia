import { NextResponse } from "next/server";
import { deleteDocument, getDocumentForUser, updateDocument } from "@/lib/documents";
import { handle, readJson, requireUser } from "@/lib/http";
import { updateDocumentSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  return NextResponse.json(await getDocumentForUser(params.id, user.id, "view"));
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const body = updateDocumentSchema.parse(await readJson(req));
  return NextResponse.json(await updateDocument(params.id, user.id, body));
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  await deleteDocument(params.id, user.id);
  return new NextResponse(null, { status: 204 });
});
