import { z } from "zod";

export const TITLE_MAX = 200;
export const CONTENT_MAX_BYTES = 1_000_000; // ~1 MB of HTML per document

const title = z
  .string()
  .trim()
  .min(1, "Title cannot be empty")
  .max(TITLE_MAX, `Title must be ${TITLE_MAX} characters or fewer`);

const content = z
  .string()
  .refine((v) => Buffer.byteLength(v, "utf8") <= CONTENT_MAX_BYTES, "Document is too large (max 1 MB)");

export const createDocumentSchema = z.object({
  title: title.optional(),
});

export const updateDocumentSchema = z
  .object({
    title: title.optional(),
    content: content.optional(),
    // Version the client last saw. Required so concurrent edits are detected.
    version: z.number().int().positive(),
  })
  .refine((v) => v.title !== undefined || v.content !== undefined, {
    message: "Nothing to update",
  });

export const shareSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: z.enum(["viewer", "editor"]),
});

export const loginSchema = z.object({
  userId: z.string().min(1),
});

export function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid request";
}
