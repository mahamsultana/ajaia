import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { firstIssue } from "./validation";
import { getCurrentUser, type User } from "./session";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Please log in.");
  return user;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

/** Wraps a route handler so thrown errors become consistent JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return jsonError(err.status, err.message);
      if (err instanceof ZodError) return jsonError(400, firstIssue(err));
      console.error(err);
      return jsonError(500, "Something went wrong. Please try again.");
    }
  };
}
