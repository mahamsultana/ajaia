import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { handle, HttpError, readJson } from "@/lib/http";
import { SESSION_COOKIE, encodeSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

// Log in as one of the seeded demo users.
export const POST = handle(async (req: Request) => {
  const { userId } = loginSchema.parse(await readJson(req));
  const { rowCount } = await query("SELECT 1 FROM users WHERE id = $1", [userId]);
  if (!rowCount) throw new HttpError(404, "Unknown user.");

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, encodeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
});

export const DELETE = handle(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
