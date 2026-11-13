"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import type { DocumentDetail } from "@/lib/documents";
import ShareDialog from "./ShareDialog";
import Icon from "./Icon";

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

const AUTOSAVE_MS = 800;

function Toolbar({ editor }: { editor: TiptapEditor }) {
  const btn = (content: React.ReactNode, title: string, active: boolean, run: () => void, text = false) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`${active ? "is-active" : ""} ${text ? "text" : ""}`}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection
      onClick={run}
    >
      {content}
    </button>
  );
  const chain = () => editor.chain().focus();
  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      {btn(<Icon name="bold" />, "Bold (Ctrl+B)", editor.isActive("bold"), () => chain().toggleBold().run())}
      {btn(<Icon name="italic" />, "Italic (Ctrl+I)", editor.isActive("italic"), () => chain().toggleItalic().run())}
      {btn(<Icon name="underline" />, "Underline (Ctrl+U)", editor.isActive("underline"), () => chain().toggleUnderline().run())}
      <span className="sep" />
      {btn("Text", "Normal text", editor.isActive("paragraph"), () => chain().setParagraph().run(), true)}
      {btn("H1", "Heading 1", editor.isActive("heading", { level: 1 }), () => chain().toggleHeading({ level: 1 }).run(), true)}
      {btn("H2", "Heading 2", editor.isActive("heading", { level: 2 }), () => chain().toggleHeading({ level: 2 }).run(), true)}
      {btn("H3", "Heading 3", editor.isActive("heading", { level: 3 }), () => chain().toggleHeading({ level: 3 }).run(), true)}
      <span className="sep" />
      {btn(<Icon name="bullets" />, "Bulleted list", editor.isActive("bulletList"), () => chain().toggleBulletList().run())}
      {btn(<Icon name="numbers" />, "Numbered list", editor.isActive("orderedList"), () => chain().toggleOrderedList().run())}
      {btn(<Icon name="quote" />, "Quote", editor.isActive("blockquote"), () => chain().toggleBlockquote().run())}
      <span className="sep" />
      {btn(<Icon name="undo" />, "Undo (Ctrl+Z)", false, () => chain().undo().run())}
      {btn(<Icon name="redo" />, "Redo (Ctrl+Shift+Z)", false, () => chain().redo().run())}
    </div>
  );
}

export default function Editor({ doc, shareCandidates }: { doc: DocumentDetail; shareCandidates: string[] }) {
  const canEdit = doc.role === "owner" || doc.role === "editor";
  const [title, setTitle] = useState(doc.title);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const versionRef = useRef(doc.version);
  const savedTitleRef = useRef(doc.title);
  const pendingRef = useRef<{ title?: string; content?: string }>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const blockedRef = useRef(false); // stop saving after a conflict

  const flush = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (inFlightRef.current || blockedRef.current) return;
    const pending = pendingRef.current;
    if (pending.title === undefined && pending.content === undefined) return;

    pendingRef.current = {};
    inFlightRef.current = true;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pending, version: versionRef.current }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409) {
        blockedRef.current = true;
        setSaveState("conflict");
        setMessage(data?.error ?? "This document changed elsewhere.");
        return;
      }
      if (!res.ok) {
        // Put the unsaved changes back so the next attempt includes them.
        pendingRef.current = { ...pending, ...pendingRef.current };
        setSaveState("error");
        setMessage(data?.error ?? "Could not save. Retrying on your next change.");
        return;
      }
      versionRef.current = data.version;
      if (pending.title !== undefined) savedTitleRef.current = pending.title;
      setMessage(null);
      const more = pendingRef.current.title !== undefined || pendingRef.current.content !== undefined;
      setSaveState(more ? "dirty" : "saved");
    } catch {
      pendingRef.current = { ...pending, ...pendingRef.current };
      setSaveState("error");
      setMessage("You appear to be offline. Changes will save when the connection returns.");
    } finally {
      inFlightRef.current = false;
    }
    if (pendingRef.current.title !== undefined || pendingRef.current.content !== undefined) {
      void flush();
    }
  }, [doc.id]);

  const schedule = useCallback(() => {
    setSaveState("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [flush]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: canEdit,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Placeholder.configure({ placeholder: canEdit ? "Start writing..." : "This document is empty." }),
    ],
    content: doc.content || "",
    onUpdate: ({ editor }) => {
      pendingRef.current.content = editor.getHTML();
      schedule();
    },
  });

  // Ctrl/Cmd+S saves immediately; warn before leaving with unsaved changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      const p = pendingRef.current;
      if (p.title !== undefined || p.content !== undefined || inFlightRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onOnline = () => void flush();
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("online", onOnline);
    };
  }, [flush]);

  function onTitleChange(value: string) {
    setTitle(value);
    const trimmed = value.trim();
    if (!trimmed) {
      delete pendingRef.current.title;
      setMessage("Title cannot be empty.");
      return;
    }
    setMessage(null);
    pendingRef.current.title = trimmed.slice(0, 200);
    schedule();
  }

  function onTitleBlur() {
    if (!title.trim()) {
      setTitle(savedTitleRef.current);
      setMessage(null);
    }
  }

  const statusText: Record<SaveState, string> = {
    saved: "All changes saved",
    dirty: "Unsaved changes",
    saving: "Saving...",
    error: "Not saved",
    conflict: "Conflict",
  };

  return (
    <div className="editor-shell">
      <div className="editor-head">
        <Link href="/" className="btn btn-ghost icon-btn" aria-label="Back to documents" title="Back to documents">
          <Icon name="back" size={20} />
        </Link>
        <div className="title-wrap">
          <input
            className="title-input"
            value={title}
            maxLength={200}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onTitleBlur}
            disabled={!canEdit}
            aria-label="Document title"
            title={canEdit ? "Click to rename" : undefined}
          />
          {canEdit && <span className="pencil"><Icon name="pencil" size={16} /></span>}
        </div>
        {canEdit && (
          <span
            className={`save-status ${saveState === "error" || saveState === "conflict" ? "error" : ""} ${saveState === "saving" || saveState === "dirty" ? "busy" : ""}`}
            aria-live="polite"
          >
            {statusText[saveState]}
          </span>
        )}
        <span className={`badge badge-${doc.role}`}>
          {doc.role === "owner" ? "Owner" : doc.role === "editor" ? "Can edit" : "View only"}
        </span>
        <a className="btn" href={`/api/documents/${doc.id}/export`} title="Download as Markdown">
          <Icon name="download" size={16} /> .md
        </a>
        {doc.role === "owner" && (
          <button className="btn-primary" onClick={() => setShareOpen(true)} aria-label="Share">
            <Icon name="share" size={16} /> Share
          </button>
        )}
      </div>

      {doc.role !== "owner" && (
        <div className="alert alert-info">
          Shared with you by {doc.ownerName}.{" "}
          {doc.role === "viewer" ? "You have view-only access." : "You can edit this document."}
        </div>
      )}
      {message && (
        <div className="alert alert-error" role="alert">
          {message}
          {saveState === "conflict" && (
            <button onClick={() => window.location.reload()}>Reload</button>
          )}
        </div>
      )}

      {canEdit && editor && <Toolbar editor={editor} />}
      <div className="page" onClick={(e) => e.target === e.currentTarget && editor?.commands.focus("end")}>
        <EditorContent editor={editor} />
      </div>

      {shareOpen && (
        <ShareDialog docId={doc.id} ownerName={doc.ownerName} candidates={shareCandidates} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
