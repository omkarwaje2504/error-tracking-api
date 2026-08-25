"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { TableSkeleton } from "@/components/Skeleton";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { getSession } from "@/lib/session";

const ROLES = ["team-member", "lead", "head"];
const TEAMS = ["graphic", "video", "frontend", "backend", "app", "all"];

const EMPTY_FORM = {
  name: "",
  email: "",
  mobile: "",
  role: "team-member",
  team: "graphic",
  password: "",
};

function roleLabel(r) {
  return (r || "").replace("-", " ");
}

export default function Users() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [edit, setEdit] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const isHead = me?.role === "head";

  useEffect(() => {
    load();
  }, [showDeleted]);

  async function load() {
    setLoading(true);
    const me = await getSession();
    if (!me) return router.push("/login");
    setMe(me);
    const url = showDeleted ? "/api/users?includeDeleted=true" : "/api/users";
    setUsers(await (await fetch(url)).json());
    setLoading(false);
  }

  function openNew() {
    setEdit(null);
    setCreating(true);
    setForm(EMPTY_FORM);
  }

  function openEdit(u) {
    setCreating(false);
    setEdit(u._id);
    setForm({
      name: u.name || "",
      email: u.email || "",
      mobile: u.mobile || "",
      role: u.role || "team-member",
      team: u.team || "graphic",
      password: "",
    });
  }

  function closeModal() {
    setEdit(null);
    setCreating(false);
    setForm(EMPTY_FORM);
  }

  async function save() {
    if (creating) {
      if (!form.name.trim() || !form.email.trim() || !form.password) {
        return toast.error("Name, email, and password are required.");
      }
      setSaving(true);
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          return toast.error((await res.json()).error || "Failed to create user.");
        }
        toast.success("User created.");
      } finally {
        setSaving(false);
      }
    } else {
      if (!form.name.trim() || !form.email.trim()) {
        return toast.error("Name and email are required.");
      }
      setSaving(true);
      try {
        const body = { ...form };
        if (!body.password) delete body.password;
        const res = await fetch(`/api/users/${edit}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) return toast.error("Failed to save user.");
        toast.success("User updated.");
      } finally {
        setSaving(false);
      }
    }
    closeModal();
    load();
  }

  async function remove(u) {
    const ok = await confirmDialog(
      `Soft delete ${u.name}? They won't be able to log in or be assigned.`,
      { danger: true, confirmLabel: "Delete" }
    );
    if (!ok) return;
    const res = await fetch(`/api/users/${u._id}`, { method: "DELETE" });
    if (!res.ok) return toast.error((await res.json()).error || "Failed to delete user.");
    toast.success(`${u.name} removed.`);
    load();
  }

  async function restore(u) {
    const res = await fetch(`/api/users/${u._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    if (!res.ok) return toast.error("Failed to restore user.");
    toast.success(`${u.name} restored.`);
    load();
  }

  const rows = useMemo(
    () =>
      users
        .filter(
          (u) =>
            !q ||
            u.name?.toLowerCase().includes(q.toLowerCase()) ||
            u.email?.toLowerCase().includes(q.toLowerCase())
        )
        .filter((u) => !roleFilter || u.role === roleFilter)
        .filter((u) => !teamFilter || u.team === teamFilter),
    [users, q, roleFilter, teamFilter]
  );

  const hasFilters = q || roleFilter || teamFilter;

  const roleBadge = (r) =>
    ({
      head: "bg-neutral-900/10 text-neutral-900 dark:bg-white/15 dark:text-white",
      lead: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
      "team-member": "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300",
    })[r] || "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300";

  return (
    <Shell user={me} onAdd={openNew}>
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
                  {roleLabel(r)}
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
        <button className="btn-primary w-full" onClick={save} disabled={saving}>
          {saving ? "Saving…" : creating ? "Create User" : "Save"}
        </button>
      </Modal>

      <div className="mb-7 flex items-center justify-between">
        <h1 className="text-2xl font-semibold sm:text-3xl">Users</h1>
        <div className="flex items-center gap-3">
          {isHead && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              <input
                type="checkbox"
                className="h-4 w-4 accent-neutral-900 dark:accent-white"
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input w-auto capitalize" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
        <select className="input w-auto capitalize" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
          <option value="">All teams</option>
          {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {hasFilters && (
          <button className="btn-ghost" onClick={() => { setQ(""); setRoleFilter(""); setTeamFilter(""); }}>
            Clear
          </button>
        )}
      </div>

      <div className="card overflow-x-auto !p-0">
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="👤"
            title={hasFilters ? "No users match these filters." : "No users yet."}
            action={isHead && !hasFilters ? "+ Add User" : undefined}
            onAction={openNew}
          />
        ) : (
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
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{u.email}</td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {u.mobile || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs capitalize ${roleBadge(u.role)}`}
                    >
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 capitalize">
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
        )}
      </div>
    </Shell>
  );
}
