"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { avatarTone, initials } from "@/components/TopBar";
import type { User } from "@/lib/session";

// Hints for reviewers about what each seeded account is set up to demonstrate.
const DEMO_NOTES: Record<string, string> = {
  "alice@ajaia.test": "Owner",
  "bob@ajaia.test": "Editor",
  "carol@ajaia.test": "No access yet",
};

export default function LoginPicker({ users }: { users: User[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function login(userId: string) {
    setBusy(userId);
    setError(null);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Login failed");
      setBusy(null);
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (users.length === 0) {
    return <div className="alert alert-error">No users found. Run <code>npm run db:setup</code> to seed demo accounts.</div>;
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {users.map((u) => (
        <button key={u.id} className="user-option" disabled={busy !== null} onClick={() => login(u.id)}>
          <span className={`avatar ${avatarTone(u.name)}`}>{initials(u.name)}</span>
          <span>
            {busy === u.id ? "Signing in..." : u.name}
            <small>{u.email}</small>
          </span>
          {DEMO_NOTES[u.email] && <span className="note">{DEMO_NOTES[u.email]}</span>}
        </button>
      ))}
    </div>
  );
}
