"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/session";
import Icon from "./Icon";

export function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

/** Stable colour class per person so the same user always gets the same avatar colour. */
export function avatarTone(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `a${(h % 4) + 1}`;
}

export default function TopBar({ user }: { user: User }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brand-mark">A</span> Ajaia Docs
      </Link>
      <div className="user-chip">
        <span className={`avatar ${avatarTone(user.name)}`} aria-hidden>{initials(user.name)}</span>
        <span className="who">
          {user.name}
          <small>{user.email}</small>
        </span>
        <button onClick={logout}>
          <Icon name="logout" size={15} /> Switch user
        </button>
      </div>
    </header>
  );
}
