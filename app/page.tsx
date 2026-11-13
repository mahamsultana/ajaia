import { redirect } from "next/navigation";
import TopBar from "@/components/TopBar";
import DocumentList from "@/components/DocumentList";
import { listDocumentsForUser } from "@/lib/documents";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const docs = await listDocumentsForUser(user.id);
  return (
    <>
      <TopBar user={user} />
      <main className="container">
        <DocumentList
          owned={docs.filter((d) => d.role === "owner")}
          shared={docs.filter((d) => d.role !== "owner")}
        />
      </main>
    </>
  );
}
