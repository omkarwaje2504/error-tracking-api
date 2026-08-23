"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FiCompass, FiHome, FiBriefcase, FiFolder, FiCheckSquare, FiUsers, FiUserCheck, FiTag, FiLogOut,
} from "react-icons/fi";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/overview", label: "Overview", icon: FiCompass, roles: ["head"] },
  { href: "/dashboard", label: "Dashboard", icon: FiHome },
  { href: "/companies", label: "Companies", icon: FiBriefcase },
  { href: "/projects", label: "Projects", icon: FiFolder },
  { href: "/products", label: "Product Types", icon: FiTag },
  { href: "/tasks", label: "Tasks", icon: FiCheckSquare },
  { href: "/team", label: "Team Structure", icon: FiUsers, roles: ["head", "lead"] },
  { href: "/users", label: "Users", icon: FiUserCheck, roles: ["head"] },
];

export default function Sidebar({ user, onAdd }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const nav = (
    <div className="flex h-full flex-col p-5">
      <div className="mb-7 flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
        >
          {(user?.name || "?").trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{user?.name || "Task Tracker"}</h2>
          <p className="text-xs capitalize text-neutral-500">{user?.role || "…"}</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {links
          .filter((l) => !l.roles || l.roles.includes(user?.role))
          .map((l) => {
            const active = pathname === l.href;
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-xl border-l-2 px-3 py-2.5 text-sm transition-colors ${active
                    ? "border-l-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                    : "border-l-transparent text-neutral-500 hover:bg-panel2 hover:text-neutral-800 dark:hover:text-neutral-300"
                  }`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{l.label}</span>
              </Link>
            );
          })}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <ThemeToggle />
        <button className="btn-ghost flex items-center justify-center gap-2" onClick={logout}>
          <FiLogOut size={15} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-3 backdrop-blur md:hidden">
        <span className="font-semibold">Task Tracker</span>
        <button
          className="btn-ghost !px-3 !py-1.5"
          onClick={() => setOpen(true)}
        >
          ☰
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line md:block">
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 border-r border-line bg-bg">
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
