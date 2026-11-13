import { redirect } from "next/navigation";
import { getCurrentUser, listUsers } from "@/lib/session";
import LoginPicker from "./LoginPicker";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const users = await listUsers();
  return (
    <div className="login-wrap">
      <section className="login-hero">
        <div className="brand">
          <span className="brand-mark">A</span> Ajaia Docs
        </div>
        <div>
          <h1>
            Write it.<br />
            <em>Share it.</em><br />
            <mark>Ship it.</mark>
          </h1>
          <p>A focused document editor for teams: rich text, file import, and clear owner, editor and viewer access.</p>
        </div>
        <div className="pills">
          <span className="pill">Rich text</span>
          <span className="pill">.txt · .md · .docx import</span>
          <span className="pill">Role-based sharing</span>
          <span className="pill">Autosave</span>
        </div>
      </section>
      <main className="login-panel">
        <div className="login-card">
          <h2>Pick a demo account</h2>
          <p>No password needed. Switch users any time to test sharing.</p>
          <LoginPicker users={users} />
        </div>
      </main>
    </div>
  );
}
