"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { DocumentSummary } from "@/lib/documents";
import Icon from "./Icon";

const ACCEPT = ".txt,.md,.docx";

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function DocumentList({
  owned,
  shared,
}: {
  owned: DocumentSummary[];
  shared: DocumentSummary[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"owned" | "shared">("owned");
  const [busy, setBusy] = useState<null | "new" | "upload">(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function createDoc() {
    setBusy("new");
    setError(null);
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not create document");
      setBusy(null);
      return;
    }
    router.push(`/docs/${data.id}`);
  }

  async function upload(file: File) {
    setBusy("upload");
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/documents/import", { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    if (fileRef.current) fileRef.current.value = "";
    if (!res.ok) {
      setError(data?.error ?? "Upload failed");
      setBusy(null);
      return;
    }
    router.push(`/docs/${data.id}`);
  }

  async function remove(doc: DocumentSummary) {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Delete failed");
      return;
    }
    router.refresh();
  }

  const docs = tab === "owned" ? owned : shared;

  function sharingLabel(d: DocumentSummary) {
    const names = d.sharedWithNames;
    if (names.length === 0) return null;
    const first = names.map((n) => n.split(" ")[0]);
    return first.length <= 2 ? first.join(" & ") : `${first.slice(0, 2).join(", ")} +${first.length - 2}`;
  }

  return (
    <>
      <div className="list-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Your documents</h1>
        </div>
        <div className="actions">
          <button onClick={() => fileRef.current?.click()} disabled={busy !== null} className="btn-lg">
            <Icon name="upload" /> {busy === "upload" ? "Importing..." : "Upload file"}
          </button>
          <button className="btn-primary btn-lg" onClick={createDoc} disabled={busy !== null}>
            <Icon name="plus" /> {busy === "new" ? "Creating..." : "New document"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            hidden
            data-testid="file-input"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </div>
      </div>
      <p className="hint upload-hint">
        Upload <span className="chip">.txt</span> <span className="chip">.md</span> <span className="chip">.docx</span>
        (max 5 MB) to turn a file into a new editable document.
      </p>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
          <button className="icon-btn" onClick={() => setError(null)} aria-label="Dismiss"><Icon name="x" size={16} /></button>
        </div>
      )}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "owned"} className={`tab ${tab === "owned" ? "active" : ""}`} onClick={() => setTab("owned")}>
          Owned by me<span className="count">{owned.length}</span>
        </button>
        <button role="tab" aria-selected={tab === "shared"} className={`tab ${tab === "shared" ? "active" : ""}`} onClick={() => setTab("shared")}>
          Shared with me<span className="count">{shared.length}</span>
        </button>
      </div>

      {docs.length === 0 ? (
        <div className="empty">
          {tab === "owned" ? (
            <><strong>A blank page awaits.</strong>Create a document or upload a file to get started.</>
          ) : (
            <><strong>Nothing shared yet.</strong>When a teammate shares a document with you, it shows up here.</>
          )}
        </div>
      ) : (
        <ul className="doc-list">
          {docs.map((d) => {
            const sharedWith = d.role === "owner" ? sharingLabel(d) : null;
            return (
              <li key={d.id} className="doc-row">
                <span className="doc-icon" aria-hidden />
                <div className="doc-main">
                  <Link href={`/docs/${d.id}`} className="doc-title">{d.title}</Link>
                  <span className="doc-meta">
                    {d.role === "owner" ? "You own this" : `From ${d.ownerName}`}
                    <span className="dot">•</span>Edited {timeAgo(d.updatedAt)}
                  </span>
                </div>
                {d.role === "owner" ? (
                  sharedWith ? (
                    <span className="badge badge-shared" title={`Shared with ${d.sharedWithNames.join(", ")}`}>
                      <Icon name="users" size={13} /> {sharedWith}
                    </span>
                  ) : (
                    <span className="badge badge-private"><Icon name="lock" size={12} /> Private</span>
                  )
                ) : (
                  <span className={`badge badge-${d.role}`}>{d.role === "editor" ? "Can edit" : "Can view"}</span>
                )}
                {d.role === "owner" && (
                  <button className="icon-btn danger" onClick={() => remove(d)} aria-label={`Delete ${d.title}`} title="Delete">
                    <Icon name="trash" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
