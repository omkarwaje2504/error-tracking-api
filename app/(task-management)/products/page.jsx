"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { colorFor } from "@/lib/colors";
import { getSession } from "@/lib/session";
import { getReference } from "@/lib/referenceCache";

export default function ProductTypes() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const me = await getSession();

    if (!me) {
      return router.push("/login");
    }

    setUser(me);
    setTypes(await getReference("productTypes"));
    setLoading(false);
  }

  function openNew() {
    setEdit(null);
    setName("");
    setOpen(true);
  }

  function openEdit(t) {
    setEdit(t._id);
    setName(t.name);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEdit(null);
    setName("");
  }

  async function save() {
    if (!name.trim()) {
      return toast.error("Name is required.");
    }

    setSaving(true);

    try {
      const url = edit ? `/api/product-types/${edit}` : "/api/product-types";

      const res = await fetch(url, {
        method: edit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (!res.ok) {
        return toast.error(data.error || "Failed to save.");
      }

      toast.success(edit ? "Product type updated." : "Product type added.");

      closeModal();
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(t) {
    const ok = await confirmDialog(`Delete "${t.name}"?`, {
      danger: true,
      confirmLabel: "Delete",
    });

    if (!ok) return;

    const res = await fetch(`/api/product-types/${t._id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      return toast.error("Failed to delete.");
    }

    toast.success("Product type deleted.");
    load();
  }

  const rows = useMemo(
    () =>
      types.filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase())),
    [types, q],
  );

  return (
    <Shell user={user} onAdd={openNew}>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Product Types</h1>

          <p className="mt-1 text-neutral-500">
            What kind of work a project is — E-Video, Poster, App, and so on.
          </p>
        </div>

        <button className="btn-primary" onClick={openNew}>
          + New
        </button>
      </div>

      <div className="mb-6">
        <input
          className="input max-w-xs"
          placeholder="Search product types…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="card overflow-hidden !p-0">
          <div className="divide-y divide-border">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-4"
              >
                <div className="h-4 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />

                <div className="h-7 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              </div>
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="🏷️"
            title={q ? "Nothing matches." : "No product types yet."}
            hint={
              q
                ? undefined
                : "You can also just type a new one straight into a project's Product type field."
            }
            action={q ? undefined : "+ New Product Type"}
            onAction={openNew}
          />
        </div>
      ) : (
        <div className="card overflow-x-auto !p-0">
          {loading ? (
            <TableSkeleton rows={5} cols={2} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon="🏷️"
              title={q ? "Nothing matches." : "No product types yet."}
              hint={
                q
                  ? undefined
                  : "You can also just type a new one straight into a project's Product type field."
              }
              action={q ? undefined : "+ New Product Type"}
              onAction={openNew}
            />
          ) : (
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3 font-medium">Product Type</th>

                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((t) => {
                  const c = colorFor(t.name);

                  return (
                    <tr
                      key={t._id}
                      className="border-b border-line/60 last:border-0 hover:bg-panel2/40"
                    >
                      <td className="px-4 py-3 font-medium">
                        <span>{t.name}</span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            className="btn-ghost !px-3 !py-1.5 !text-xs"
                            onClick={() => openEdit(t)}
                          >
                            Edit
                          </button>

                          <button
                            className="btn-ghost !px-3 !py-1.5 !text-xs text-red-500"
                            onClick={() => remove(t)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal
        open={open}
        onClose={closeModal}
        title={edit ? "Edit Product Type" : "New Product Type"}
      >
        <div className="mb-5">
          <label className="label">Name</label>

          <input
            className="input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>

        <button className="btn-primary w-full" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </Modal>
    </Shell>
  );
}
