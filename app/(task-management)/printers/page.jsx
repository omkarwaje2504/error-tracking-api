"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { TableSkeleton } from "@/components/Skeleton";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { colorFor } from "@/lib/colors";
import { getSession } from "@/lib/session";
import { getReference } from "@/lib/referenceCache";

export default function Printers() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emailId, setEmailId] = useState("");
  const [printerType, setPrinterType] = useState("");
  const [pageColor, setPageColor] = useState("");
  const [fileType, setFileType] = useState("");
  const [pageType, setPageType] = useState("");
  const [fileSizes, setFileSizes] = useState([]);
  const [fileSizeInput, setFileSizeInput] = useState("");
  const [saving, setSaving] = useState(false);

  function addFileSize() {
    const v = fileSizeInput.trim();
    if (v && !fileSizes.includes(v)) setFileSizes((s) => [...s, v]);
    setFileSizeInput("");
  }

  function removeFileSize(v) {
    setFileSizes((s) => s.filter((x) => x !== v));
  }

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
    setPrinters(await getReference("printers"));
    setLoading(false);
  }

  function resetForm() {
    setName("");
    setEmailId("");
    setPrinterType("");
    setPageColor("");
    setFileType("");
    setPageType("");
    setFileSizes([]);
    setFileSizeInput("");
  }

  function openNew() {
    setEdit(null);
    resetForm();
    setOpen(true);
  }

  function openEdit(p) {
    setEdit(p._id);
    setName(p.name || "");
    setEmailId(p.email_id || "");
    setPrinterType(p.printer_type || "");
    setPageColor(p.page_color || "");
    setFileType(p.file_type || "");
    setPageType(p.page_type || "");
    setFileSizes(p.file_sizes || []);
    setFileSizeInput("");
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEdit(null);
    resetForm();
  }

  async function save() {
    if (!name.trim()) {
      return toast.error("Name is required.");
    }

    if (!emailId.trim()) {
      return toast.error("Email ID is required.");
    }

    setSaving(true);

    try {
      const url = edit ? `/api/printers/${edit}` : "/api/printers";

      const res = await fetch(url, {
        method: edit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email_id: emailId.trim(),
          printer_type: printerType.trim(),
          page_color: pageColor.trim(),
          file_type: fileType.trim(),
          page_type: pageType.trim(),
          file_sizes: fileSizes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return toast.error(data.error || "Failed to save.");
      }

      toast.success(edit ? "Printer updated." : "Printer added.");

      closeModal();
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(p) {
    const ok = await confirmDialog(`Delete "${p.name}"?`, {
      danger: true,
      confirmLabel: "Delete",
    });

    if (!ok) return;

    const res = await fetch(`/api/printers/${p._id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      return toast.error("Failed to delete.");
    }

    toast.success("Printer deleted.");
    load();
  }

  const rows = useMemo(
    () =>
      printers.filter(
        (p) =>
          !q ||
          p.name?.toLowerCase().includes(q.toLowerCase()) ||
          p.email_id?.toLowerCase().includes(q.toLowerCase()),
      ),
    [printers, q],
  );

  return (
    <Shell user={user} onAdd={openNew}>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Printer Types</h1>

          <p className="mt-1 text-neutral-500">
            The printers a Production action can be sent to.
          </p>
        </div>

        <button className="btn-primary" onClick={openNew}>
          + New
        </button>
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
        {loading ? (
          <TableSkeleton rows={5} cols={3} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="🖨️"
            title={q ? "Nothing matches." : "No printers yet."}
            hint={
              q
                ? undefined
                : "You can also just type a new one straight into a project's Production → Printer field."
            }
            action={q ? undefined : "+ New Printer"}
            onAction={openNew}
          />
        ) : (
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3 font-medium">Printer Name</th>

                <th className="px-4 py-3 font-medium">Email ID</th>

                <th className="px-4 py-3 font-medium">File Sizes</th>

                <th className="px-4 py-3 font-medium">Printer Type</th>

                <th className="px-4 py-3 font-medium">Page Color</th>

                <th className="px-4 py-3 font-medium">File Type</th>

                <th className="px-4 py-3 font-medium">Page Type</th>

                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((p) => {
                const c = colorFor(p.name);

                return (
                  <tr
                    key={p._id}
                    className="border-b border-line/60 last:border-0 hover:bg-panel2/40"
                  >
                    <td className="px-4 py-3 font-medium">
                      <span>{p.name}</span>
                    </td>

                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {p.email_id || "—"}
                    </td>

                    <td className="px-4 py-3">
                      {p.file_sizes?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {p.file_sizes.map((s) => (
                            <span key={s} className="rounded-full bg-panel2 px-2 py-0.5 text-[11px] text-neutral-600 dark:text-neutral-400">
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {p.printer_type || "—"}
                    </td>

                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {p.page_color || "—"}
                    </td>

                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {p.file_type || "—"}
                    </td>

                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {p.page_type || "—"}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn-ghost !px-3 !py-1.5 !text-xs"
                          onClick={() => openEdit(p)}
                        >
                          Edit
                        </button>

                        <button
                          className="btn-ghost !px-3 !py-1.5 !text-xs text-red-500"
                          onClick={() => remove(p)}
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

      <Modal
        open={open}
        onClose={closeModal}
        title={edit ? "Edit Printer" : "New Printer"}
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

        <div className="mb-5">
          <label className="label">Email ID</label>

          <input
            className="input"
            type="email"
            value={emailId}
            onChange={(e) => setEmailId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>

        <div className="mb-5 flex gap-3">
          <div className="flex-1">
            <label className="label">Printer Type</label>
            <input
              className="input"
              placeholder="e.g. Digital, Offset, UV"
              value={printerType}
              onChange={(e) => setPrinterType(e.target.value)}
            />
          </div>

          <div className="flex-1">
            <label className="label">Page Color</label>
            <select className="input" value={pageColor} onChange={(e) => setPageColor(e.target.value)}>
              <option value="">—</option>
              <option value="Color">Color</option>
              <option value="B&W">B&W</option>
              <option value="Both">Both</option>
            </select>
          </div>
        </div>

        <div className="mb-5 flex gap-3">
          <div className="flex-1">
            <label className="label">File Type</label>
            <input
              className="input"
              placeholder="e.g. PDF, AI, PSD"
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
            />
          </div>

          <div className="flex-1">
            <label className="label">Page Type</label>
            <input
              className="input"
              placeholder="e.g. Glossy, Matte"
              value={pageType}
              onChange={(e) => setPageType(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-5">
          <label className="label">File Sizes (multiple)</label>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="e.g. A4 — press Enter to add"
              value={fileSizeInput}
              onChange={(e) => setFileSizeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addFileSize();
                }
              }}
            />
            <button type="button" className="btn-ghost shrink-0" onClick={addFileSize}>
              Add
            </button>
          </div>
          {fileSizes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fileSizes.map((s) => (
                <span
                  key={s}
                  className="flex items-center gap-1 rounded-full bg-panel2 px-2.5 py-1 text-xs text-neutral-700 dark:text-neutral-300"
                >
                  {s}
                  <button
                    type="button"
                    className="text-neutral-500 hover:text-red-400"
                    onClick={() => removeFileSize(s)}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button className="btn-primary w-full" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </Modal>
    </Shell>
  );
}
