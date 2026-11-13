import crypto from "node:crypto";
import { cookies } from "next/headers";
import { query } from "./db";

// Mock auth: the user picks a seeded account and we store their id in an
// HMAC-signed, httpOnly cookie. Swapping this for real auth (OAuth, magic links)
// only touches this file and the login page.

export const SESSION_COOKIE = "ajaia_session";

export interface User {
  id: string;
  email: string;
  name: string;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return s || "dev-only-secret";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export function encodeSession(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function decodeSession(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const userId = token.slice(0, i);
  const expected = Buffer.from(sign(userId));
  const actual = Buffer.from(token.slice(i + 1));
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  return userId;
}

export async function getCurrentUser(): Promise<User | null> {
  const userId = decodeSession(cookies().get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const { rows } = await query<User>("SELECT id, email, name FROM users WHERE id = $1", [userId]);
  return rows[0] ?? null;
}

export async function listUsers(): Promise<User[]> {
  const { rows } = await query<User>("SELECT id, email, name FROM users ORDER BY name");
  return rows;
}
