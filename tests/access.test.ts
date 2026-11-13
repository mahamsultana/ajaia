import { describe, expect, it } from "vitest";
import { can, checkShareTarget, resolveRole, type AccessSubject } from "@/lib/access";

const doc: AccessSubject = {
  ownerId: "alice",
  shares: [
    { userId: "bob", role: "editor" },
    { userId: "carol", role: "viewer" },
  ],
};

describe("resolveRole", () => {
  it("identifies owner, editor, viewer and strangers", () => {
    expect(resolveRole(doc, "alice")).toBe("owner");
    expect(resolveRole(doc, "bob")).toBe("editor");
    expect(resolveRole(doc, "carol")).toBe("viewer");
    expect(resolveRole(doc, "mallory")).toBeNull();
    expect(resolveRole(doc, null)).toBeNull();
  });
});

describe("can", () => {
  it("gives owners every permission", () => {
    for (const a of ["view", "edit", "rename", "share", "delete"] as const) expect(can("owner", a)).toBe(true);
  });
  it("lets editors edit and rename but not share or delete", () => {
    expect(can("editor", "edit")).toBe(true);
    expect(can("editor", "rename")).toBe(true);
    expect(can("editor", "share")).toBe(false);
    expect(can("editor", "delete")).toBe(false);
  });
  it("keeps viewers read only", () => {
    expect(can("viewer", "view")).toBe(true);
    expect(can("viewer", "edit")).toBe(false);
    expect(can("viewer", "rename")).toBe(false);
  });
  it("denies everything without a role", () => {
    expect(can(null, "view")).toBe(false);
  });
});

describe("checkShareTarget", () => {
  it("rejects sharing a document with its owner", () => {
    expect(checkShareTarget(doc, "alice").ok).toBe(false);
    expect(checkShareTarget(doc, "dave").ok).toBe(true);
  });
});
