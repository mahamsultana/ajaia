import { describe, expect, it } from "vitest";
import { shareSchema, updateDocumentSchema } from "@/lib/validation";

describe("updateDocumentSchema", () => {
  it("requires a version and at least one field", () => {
    expect(updateDocumentSchema.safeParse({ title: "x" }).success).toBe(false);
    expect(updateDocumentSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(updateDocumentSchema.safeParse({ version: 1, content: "<p>hi</p>" }).success).toBe(true);
  });
  it("rejects blank and overly long titles", () => {
    expect(updateDocumentSchema.safeParse({ version: 1, title: "   " }).success).toBe(false);
    expect(updateDocumentSchema.safeParse({ version: 1, title: "a".repeat(201) }).success).toBe(false);
  });
});

describe("shareSchema", () => {
  it("normalizes email and validates role", () => {
    expect(shareSchema.parse({ email: " Bob@Ajaia.TEST ", role: "viewer" }).email).toBe("bob@ajaia.test");
    expect(shareSchema.safeParse({ email: "nope", role: "viewer" }).success).toBe(false);
    expect(shareSchema.safeParse({ email: "a@b.co", role: "admin" }).success).toBe(false);
  });
});
