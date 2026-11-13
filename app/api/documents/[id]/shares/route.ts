import { NextResponse } from "next/server";
import { listShares, shareDocument } from "@/lib/documents";
import { handle, readJson, requireUser } from "@/lib/http";
import { shareSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  return NextResponse.json({ shares: await listShares(params.id, user.id) });
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { email, role } = shareSchema.parse(await readJson(req));
  const share = await shareDocument(params.id, user.id, email, role);
  return NextResponse.json(share, { status: 201 });
});
