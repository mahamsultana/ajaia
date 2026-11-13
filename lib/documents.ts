import { query, getPool } from "./db";
import { can, checkShareTarget, resolveRole, type Action, type Role, type ShareRole } from "./access";
import { HttpError } from "./http";
import { sanitizeDocumentHtml } from "./sanitize";

export interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: string;
  ownerId: string;
  ownerName: string;
  role: Role;
  sharedWithCount: number;
  /** Names of people the doc is shared with (only returned to the owner). */
  sharedWithNames: string[];
}

export interface DocumentDetail {
  id: string;
  title: string;
  content: string;
  version: number;
  updatedAt: string;
  ownerId: string;
  ownerName: string;
  role: Role;
}

export interface ShareEntry {
  userId: string;
  email: string;
  name: string;
  role: ShareRole;
}

interface DocRow {
  id: string;
  title: string;
  content: string;
  version: number;
  updated_at: Date;
  owner_id: string;
  owner_name: string;
}

/** Lists every document the user owns or has been granted, newest first. */
export async function listDocumentsForUser(userId: string): Promise<DocumentSummary[]> {
  const { rows } = await query<{
    id: string;
    title: string;
    updated_at: Date;
    owner_id: string;
    owner_name: string;
    role: Role;
    share_count: string;
    share_names: string[] | null;
  }>(
    `SELECT d.id, d.title, d.updated_at, d.owner_id, u.name AS owner_name,
            CASE WHEN d.owner_id = $1 THEN 'owner' ELSE s.role END AS role,
            (SELECT count(*) FROM document_shares x WHERE x.document_id = d.id) AS share_count,
            CASE WHEN d.owner_id = $1 THEN
              (SELECT array_agg(su.name ORDER BY su.name)
                 FROM document_shares x JOIN users su ON su.id = x.user_id
                WHERE x.document_id = d.id)
            END AS share_names
       FROM documents d
       JOIN users u ON u.id = d.owner_id
       LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = $1
      WHERE d.owner_id = $1 OR s.user_id = $1
      ORDER BY d.updated_at DESC`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updated_at.toISOString(),
    ownerId: r.owner_id,
    ownerName: r.owner_name,
    role: r.role,
    sharedWithCount: Number(r.share_count),
    sharedWithNames: r.share_names ?? [],
  }));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads a document and the caller's role, enforcing `action`.
 * Returns 404 (not 403) when the caller has no access at all, so document ids
 * cannot be probed.
 */
export async function getDocumentForUser(
  docId: string,
  userId: string,
  action: Action = "view",
): Promise<DocumentDetail> {
  if (!UUID_RE.test(docId)) throw new HttpError(404, "Document not found.");
  const { rows } = await query<DocRow>(
    `SELECT d.id, d.title, d.content, d.version, d.updated_at, d.owner_id, u.name AS owner_name
       FROM documents d JOIN users u ON u.id = d.owner_id
      WHERE d.id = $1`,
    [docId],
  );
  const doc = rows[0];
  if (!doc) throw new HttpError(404, "Document not found.");

  const shares = await query<{ user_id: string; role: ShareRole }>(
    "SELECT user_id, role FROM document_shares WHERE document_id = $1",
    [docId],
  );
  const role = resolveRole(
    { ownerId: doc.owner_id, shares: shares.rows.map((s) => ({ userId: s.user_id, role: s.role })) },
    userId,
  );
  if (!role) throw new HttpError(404, "Document not found.");
  if (!can(role, action)) {
    throw new HttpError(403, `Your ${role} access does not allow you to ${action} this document.`);
  }

  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    version: doc.version,
    updatedAt: doc.updated_at.toISOString(),
    ownerId: doc.owner_id,
    ownerName: doc.owner_name,
    role,
  };
}

export async function createDocument(
  ownerId: string,
  input: { title?: string; html?: string; sourceFile?: string },
): Promise<{ id: string }> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO documents (title, content, owner_id, source_file)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      input.title ?? "Untitled document",
      input.html ? sanitizeDocumentHtml(input.html) : "",
      ownerId,
      input.sourceFile ?? null,
    ],
  );
  return rows[0];
}

/**
 * Saves title and/or content using optimistic concurrency: the write only
 * applies if the stored version still matches what the client last loaded.
 */
export async function updateDocument(
  docId: string,
  userId: string,
  input: { title?: string; content?: string; version: number },
): Promise<{ version: number; updatedAt: string }> {
  const doc = await getDocumentForUser(docId, userId, input.content !== undefined ? "edit" : "rename");
  if (input.title !== undefined && !can(doc.role, "rename")) {
    throw new HttpError(403, "You cannot rename this document.");
  }

  const { rows } = await query<{ version: number; updated_at: Date }>(
    `UPDATE documents
        SET title = COALESCE($3, title),
            content = COALESCE($4, content),
            version = version + 1,
            updated_at = now()
      WHERE id = $1 AND version = $2
      RETURNING version, updated_at`,
    [
      docId,
      input.version,
      input.title ?? null,
      input.content !== undefined ? sanitizeDocumentHtml(input.content) : null,
    ],
  );
  if (rows.length === 0) {
    throw new HttpError(
      409,
      "This document was changed by someone else since you opened it. Reload to get the latest version.",
    );
  }
  return { version: rows[0].version, updatedAt: rows[0].updated_at.toISOString() };
}

export async function deleteDocument(docId: string, userId: string): Promise<void> {
  await getDocumentForUser(docId, userId, "delete");
  await query("DELETE FROM documents WHERE id = $1", [docId]);
}

export async function listShares(docId: string, userId: string): Promise<ShareEntry[]> {
  await getDocumentForUser(docId, userId, "view");
  const { rows } = await query<{ user_id: string; email: string; name: string; role: ShareRole }>(
    `SELECT s.user_id, u.email, u.name, s.role
       FROM document_shares s JOIN users u ON u.id = s.user_id
      WHERE s.document_id = $1 ORDER BY u.name`,
    [docId],
  );
  return rows.map((r) => ({ userId: r.user_id, email: r.email, name: r.name, role: r.role }));
}

/** Grants (or updates) access for the user with `email`. Owner only. */
export async function shareDocument(
  docId: string,
  ownerId: string,
  email: string,
  role: ShareRole,
): Promise<ShareEntry> {
  const doc = await getDocumentForUser(docId, ownerId, "share");
  const target = await query<{ id: string; email: string; name: string }>(
    "SELECT id, email, name FROM users WHERE lower(email) = lower($1)",
    [email],
  );
  const user = target.rows[0];
  if (!user) throw new HttpError(404, `No user with email ${email}. Try one of the demo accounts.`);

  const check = checkShareTarget({ ownerId: doc.ownerId, shares: [] }, user.id);
  if (!check.ok) throw new HttpError(400, check.reason);

  await getPool().query(
    `INSERT INTO document_shares (document_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (document_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [docId, user.id, role],
  );
  return { userId: user.id, email: user.email, name: user.name, role };
}

export async function revokeShare(docId: string, ownerId: string, targetUserId: string): Promise<void> {
  await getDocumentForUser(docId, ownerId, "share");
  await query("DELETE FROM document_shares WHERE document_id = $1 AND user_id = $2", [
    docId,
    targetUserId,
  ]);
}
