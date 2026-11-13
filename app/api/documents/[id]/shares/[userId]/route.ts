import { NextResponse } from "next/server";
import { revokeShare } from "@/lib/documents";
import { handle, requireUser } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: { id: string; userId: string } };

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  await revokeShare(params.id, user.id, params.userId);
  return new NextResponse(null, { status: 204 });
});
