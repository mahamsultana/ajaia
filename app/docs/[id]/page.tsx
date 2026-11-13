import Link from "next/link";
import { redirect } from "next/navigation";
import TopBar from "@/components/TopBar";
import Editor from "@/components/Editor";
import { getDocumentForUser, type DocumentDetail } from "@/lib/documents";
import { HttpError } from "@/lib/http";
import { getCurrentUser, listUsers } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let doc: DocumentDetail;
  try {
    doc = await getDocumentForUser(params.id, user.id, "view");
  } catch (err) {
    if (err instanceof HttpError) {
      return (
        <>
          <TopBar user={user} />
          <main className="center-msg">
            <h1>Document not available</h1>
            <p className="hint">It may have been deleted, or it has not been shared with {user.email}.</p>
            <Link href="/" className="btn">Back to documents</Link>
          </main>
        </>
      );
    }
    throw err;
  }

  const candidates = doc.role === "owner"
    ? (await listUsers()).filter((u) => u.id !== user.id).map((u) => u.email)
    : [];

  return (
    <>
      <TopBar user={user} />
      {/* key forces a fresh editor when navigating between documents */}
      <Editor key={doc.id} doc={doc} shareCandidates={candidates} />
    </>
  );
}
