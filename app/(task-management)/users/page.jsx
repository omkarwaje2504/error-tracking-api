"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";

const ROLES = ["designer", "lead", "head"];
const TEAMS = ["graphic", "video", "frontend", "backend", "app", "all"];

export default function Users() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    role: "designer",
    team: "graphic",
    password: "",
  });

  const isHead = me?.role === "head";

  useEffect(() => {
    load();
  }, [showDeleted]);

  async function load() {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return router.push("/login");
    setMe(await res.json());
    const url = showDeleted ? "/api/users?includeDeleted=true" : "/api/users";
    setUsers(await (await fetch(url)).json());
  }

  function openEdit(u) {
    setEdit(u._id);
    setForm({
      name: u.name || "",
      email: u.email || "",
      mobile: u.mobile || "",
      role: u.role || "designer",
      team: u.team || "graphic",
      password: "",
    });
  }
  function openNew() {
    setEdit(null);
    setCreating(true);
    setForm({
      name: "",
      email: "",
      mobile: "",
      role: "designer",
      team: "graphic",
      password: "",
    });
  }

  function openEdit(u) {
    setCreating(false);
    setEdit(u._id);
    setForm({
      name: u.name || "",
      email: u.email || "",
      mobile: u.mobile || "",
      role: u.role || "designer",
      team: u.team || "graphic",
      password: "",
    });
  }

  function closeModal() {
    setEdit(null);
    setCreating(false);
    setForm({
      name: "",
      email: "",
      mobile: "",
      role: "designer",
      team: "graphic",
      password: "",
    });
  }

  async function save() {
    const body = { ...form };
    if (!body.password) delete body.password; // don't overwrite with blank
    await fetch(`/api/users/${edit}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    closeModal();
    load();
  }

  async function remove(u) {
    if (
      !confirm(
        `Soft delete ${u.name}? They won't be able to log in or be assigned.`,
      )
    )
      return;
    const res = await fetch(`/api/users/${u._id}`, { method: "DELETE" });
    if (!res.ok) alert((await res.json()).error || "Failed");
    load();
  }

  async function restore(u) {
    await fetch(`/api/users/${u._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    load();
  }

  const rows = users.filter(
    (u) =>
      !q ||
      u.name?.toLowerCase().includes(q.toLowerCase()) ||
      u.email?.toLowerCase().includes(q.toLowerCase()),
  );

  const roleBadge = (r) =>
    ({
      head: "bg-white/15 text-white",
      lead: "bg-blue-500/15 text-blue-300",
      designer: "bg-neutral-500/15 text-neutral-300",
    })[r] || "bg-neutral-500/15 text-neutral-300";

  async function save() {
    if (creating) {
      if (!form.name || !form.email || !form.password) {
        return alert("Name, email, and password are required.");
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok)
        return alert((await res.json()).error || "Failed to create user");
    } else {
      const body = { ...form };
      if (!body.password) delete body.password;
      await fetch(`/api/users/${edit}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    closeModal();
    load();
  }

  return (
    <Shell user={me} onAdd={() => router.push("/login")}>
      <Modal
        open={creating || !!edit}
        onClose={closeModal}
        title={creating ? "Add User" : "Edit User"}
      >
        <div className="mb-3.5">
          <label className="label">Name</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="mb-3.5">
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="mb-3.5">
          <label className="label">Mobile</label>
          <input
            className="input"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
        </div>
        <div className="mb-3.5 flex gap-3">
          <div className="flex-1">
            <label className="label">Role</label>
            <select
              className="input capitalize"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="label">Team</label>
            <select
              className="input capitalize"
              value={form.team}
              onChange={(e) => setForm({ ...form, team: e.target.value })}
            >
              {TEAMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-5">
          <label className="label">
            {creating ? "Password" : "Reset password (optional)"}
          </label>
          <input
            className="input"
            type="password"
            placeholder={
              creating ? "Set a password" : "Leave blank to keep current"
            }
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <button className="btn-primary w-full" onClick={save}>
          {creating ? "Create User" : "Save"}
        </button>
      </Modal>
      <div className="mb-7 flex items-center justify-between">
        <h1 className="text-2xl font-semibold sm:text-3xl">Users</h1>
        <div className="flex items-center gap-3">
          {isHead && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-400">
              <input
                type="checkbox"
                className="h-4 w-4 accent-white"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              Show removed
            </label>
          )}
          {isHead && (
            <button className="btn-primary" onClick={openNew}>
              + Add User
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <input
          className="input max-w-xs"
          placeholder="Search name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Mobile</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Team</th>
              {isHead && (
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={isHead ? 6 : 5}
                  className="px-4 py-8 text-center text-neutral-500"
                >
                  No users.
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr
                key={u._id}
                className={`border-b border-line/60 last:border-0 hover:bg-panel2/40 ${u.deleted ? "opacity-50" : ""}`}
              >
                <td className="px-4 py-3 font-medium">
                  {u.name}
                  {u.deleted && (
                    <span className="ml-2 text-xs text-red-400">removed</span>
                  )}
                  {me?.id === u._id && (
                    <span className="ml-2 text-xs text-neutral-500">you</span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-400">{u.email}</td>
                <td className="px-4 py-3 text-neutral-400">
                  {u.mobile || "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs capitalize ${roleBadge(u.role)}`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-400 capitalize">
                  {u.team}
                </td>
                {isHead && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {u.deleted ? (
                        <button
                          className="btn-ghost !px-3 !py-1.5 !text-xs"
                          onClick={() => restore(u)}
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          <button
                            className="btn-ghost !px-3 !py-1.5 !text-xs"
                            onClick={() => openEdit(u)}
                          >
                            Edit
                          </button>
                          {me?.id !== u._id && (
                            <button
                              className="btn-ghost !px-3 !py-1.5 !text-xs"
                              onClick={() => remove(u)}
                            >
                              Remove
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!edit} onClose={closeModal} title="Edit User">
        <div className="mb-3.5">
          <label className="label">Name</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="mb-3.5">
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="mb-3.5">
          <label className="label">Mobile</label>
          <input
            className="input"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
        </div>
        <div className="mb-3.5 flex gap-3">
          <div className="flex-1">
            <label className="label">Role</label>
            <select
              className="input capitalize"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="label">Team</label>
            <select
              className="input capitalize"
              value={form.team}
              onChange={(e) => setForm({ ...form, team: e.target.value })}
            >
              {TEAMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-5">
          <label className="label">Reset password (optional)</label>
          <input
            className="input"
            type="password"
            placeholder="Leave blank to keep current"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <button className="btn-primary w-full" onClick={save}>
          Save
        </button>
      </Modal>
    </Shell>
  );
}
