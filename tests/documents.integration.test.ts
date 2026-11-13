// End-to-end check of the data + access layer against a real Postgres.
// Runs only when TEST_DATABASE_URL is set (see README), so `npm test` stays
// green on machines without a database.
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("documents + sharing (Postgres)", () => {
  let docs: typeof import("@/lib/documents");
  let db: typeof import("@/lib/db");
  const A = "t_owner";
  const B = "t_friend";
  const C = "t_stranger";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("@/lib/db");
    docs = await import("@/lib/documents");
    await db.query(fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8"));
    for (const [id, name] of [[A, "Owner"], [B, "Friend"], [C, "Stranger"]]) {
      await db.query(
        "INSERT INTO users (id, email, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
        [id, `${id}@test.local`, name],
      );
    }
  });

  afterAll(async () => {
    await db.query("DELETE FROM users WHERE id = ANY($1)", [[A, B, C]]);
    await db.getPool().end();
  });

  it("enforces owner / viewer / editor access through the full lifecycle", async () => {
    const { id } = await docs.createDocument(A, { title: "Plan", html: "<p>v1</p><script>x</script>" });

    // Content is sanitized on the way in.
    const own = await docs.getDocumentForUser(id, A);
    expect(own.content).toBe("<p>v1</p>");
    expect(own.role).toBe("owner");

    // Strangers cannot even see that the document exists.
    await expect(docs.getDocumentForUser(id, C)).rejects.toMatchObject({ status: 404 });

    // Share as viewer: B can read, cannot edit, and sees it under "shared".
    await docs.shareDocument(id, A, `${B}@test.local`, "viewer");
    expect((await docs.getDocumentForUser(id, B)).role).toBe("viewer");
    await expect(
      docs.updateDocument(id, B, { content: "<p>hack</p>", version: own.version }),
    ).rejects.toMatchObject({ status: 403 });
    const listB = await docs.listDocumentsForUser(B);
    expect(listB.find((d) => d.id === id)?.role).toBe("viewer");

    // Only the owner can share.
    await expect(docs.shareDocument(id, B, `${C}@test.local`, "viewer")).rejects.toMatchObject({ status: 403 });

    // Upgrade to editor: B can now save, and the version advances.
    await docs.shareDocument(id, A, `${B}@test.local`, "editor");
    const saved = await docs.updateDocument(id, B, { content: "<h2>v2</h2>", version: own.version });
    expect(saved.version).toBe(own.version + 1);

    // A stale write from the owner is rejected instead of silently overwriting.
    await expect(
      docs.updateDocument(id, A, { content: "<p>stale</p>", version: own.version }),
    ).rejects.toMatchObject({ status: 409 });

    // Revoke: B loses access.
    await docs.revokeShare(id, A, B);
    await expect(docs.getDocumentForUser(id, B)).rejects.toMatchObject({ status: 404 });

    // Editors cannot delete; owners can.
    await docs.deleteDocument(id, A);
    await expect(docs.getDocumentForUser(id, A)).rejects.toMatchObject({ status: 404 });
  });
});
