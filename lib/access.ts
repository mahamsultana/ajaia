// Pure access-control rules. No I/O here so they are easy to unit test.

export type ShareRole = "viewer" | "editor";
export type Role = "owner" | ShareRole;
export type Action = "view" | "edit" | "rename" | "share" | "delete";

export interface AccessSubject {
  ownerId: string;
  shares: { userId: string; role: ShareRole }[];
}

/** Returns the caller's role on a document, or null when they have no access. */
export function resolveRole(doc: AccessSubject, userId: string | null | undefined): Role | null {
  if (!userId) return null;
  if (doc.ownerId === userId) return "owner";
  const share = doc.shares.find((s) => s.userId === userId);
  return share ? share.role : null;
}

const PERMISSIONS: Record<Role, ReadonlySet<Action>> = {
  owner: new Set<Action>(["view", "edit", "rename", "share", "delete"]),
  editor: new Set<Action>(["view", "edit", "rename"]),
  viewer: new Set<Action>(["view"]),
};

export function can(role: Role | null, action: Action): boolean {
  return role !== null && PERMISSIONS[role].has(action);
}

/** Validation for a share request, independent of the database. */
export function checkShareTarget(
  doc: AccessSubject,
  targetUserId: string,
): { ok: true } | { ok: false; reason: string } {
  if (targetUserId === doc.ownerId) {
    return { ok: false, reason: "The owner already has full access to this document." };
  }
  return { ok: true };
}
