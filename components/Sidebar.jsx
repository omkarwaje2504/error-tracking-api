"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/companies", label: "Companies" },
  { href: "/brands", label: "Brands" },
  { href: "/projects", label: "Projects" },
  { href: "/tasks", label: "Tasks" },
  { href: "/users", label: "Users" },
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
      <div className="mb-7">
        <h2 className="text-lg font-semibold">Task Tracker</h2>
        <p className="mt-0.5 text-xs text-neutral-500 capitalize">
          {user?.name} · {user?.role}
        </p>
      </div>

      <nav className="flex flex-col gap-1">
        {links
          .filter((l) => l.href !== "/users" || user?.role === "head")
          .map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
                pathname === l.href
                  ? "bg-panel2 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {l.label}
            </Link>
          ))}
      </nav>

      <button className="btn-ghost mt-auto" onClick={logout}>
        Logout
      </button>
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
