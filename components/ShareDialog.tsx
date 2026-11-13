"use client";

import { useEffect, useState } from "react";
import type { ShareEntry } from "@/lib/documents";
import Icon from "./Icon";
import { avatarTone, initials } from "./TopBar";

export default function ShareDialog({
  docId,
  ownerName,
  candidates,
  onClose,
}: {
  docId: string;
  ownerName: string;
  candidates: string[];
  onClose: () => void;
}) {
  const [shares, setShares] = useState<ShareEntry[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/documents/${docId}/shares`);
    const data = await res.json().catch(() => null);
    if (!res.ok) return setError(data?.error ?? "Could not load sharing settings");
    setShares(data.shares);
  }

  useEffect(() => {
    void load();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/documents/${docId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(data?.error ?? "Could not share");
    setEmail("");
    await load();
  }

  async function changeRole(userId: string, emailOf: string, next: "viewer" | "editor") {
    const res = await fetch(`/api/documents/${docId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailOf, role: next }),
    });
    if (!res.ok) return setError((await res.json().catch(() => null))?.error ?? "Could not update access");
    await load();
  }

  async function revoke(userId: string) {
    const res = await fetch(`/api/documents/${docId}/shares/${encodeURIComponent(userId)}`, { method: "DELETE" });
    if (!res.ok) return setError((await res.json().catch(() => null))?.error ?? "Could not remove access");
    await load();
  }

  const available = candidates.filter((c) => !shares?.some((s) => s.email === c));

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <h2 id="share-title">Share this document</h2>
        <p className="sub">
          Invite a teammate by email. Demo accounts: {candidates.join(", ") || "none"}.
        </p>

        <form className="share-form" onSubmit={add}>
          <input
            type="email"
            required
            placeholder="name@ajaia.test"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            list="share-candidates"
            aria-label="Email to share with"
            autoFocus
          />
          <datalist id="share-candidates">
            {available.map((c) => <option key={c} value={c} />)}
          </datalist>
          <select value={role} onChange={(e) => setRole(e.target.value as "viewer" | "editor")} aria-label="Access level">
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <button className="btn-primary" disabled={busy || !email}>{busy ? "Sharing..." : "Share"}</button>
        </form>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <p className="section-label">People with access</p>
        <ul className="share-list">
          <li>
            <span className={`avatar ${avatarTone(ownerName)}`} aria-hidden>{initials(ownerName)}</span>
            <div className="who">
              {ownerName} (you)
              <small>Can share, edit and delete</small>
            </div>
            <span className="badge badge-owner">Owner</span>
          </li>
          {shares === null ? (
            <li className="hint">Loading...</li>
          ) : shares.length === 0 ? (
            <li className="hint">No one else yet. Only you can open this document.</li>
          ) : (
            shares.map((s) => (
              <li key={s.userId}>
                <span className={`avatar ${avatarTone(s.name)}`} aria-hidden>{initials(s.name)}</span>
                <div className="who">
                  {s.name}
                  <small>{s.email}</small>
                </div>
                <select
                  value={s.role}
                  onChange={(e) => changeRole(s.userId, s.email, e.target.value as "viewer" | "editor")}
                  aria-label={`Access for ${s.name}`}
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
                <button className="icon-btn danger" onClick={() => revoke(s.userId)} aria-label={`Remove ${s.name}`} title="Remove access">
                  <Icon name="x" />
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="dialog-foot">
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
