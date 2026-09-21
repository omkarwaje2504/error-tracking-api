"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { colorFor } from "@/lib/colors";
import { getSession } from "@/lib/session";
import { getReference } from "@/lib/referenceCache";

export default function CompaniesAndBrands() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  const [companyModal, setCompanyModal] = useState(false);
  const [companyEdit, setCompanyEdit] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [companySaving, setCompanySaving] = useState(false);

  const [brandModal, setBrandModal] = useState(null); // { companyId, editId, name }
  const [brandSaving, setBrandSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const me = await getSession();
    if (!me) return router.push("/login");
    setUser(me);
    setCompanies(await getReference("companies"));
    setBrands(await getReference("brands"));
    setLoading(false);
  }

  function openNewCompany() {
    setCompanyEdit(null);
    setCompanyName("");
    setCompanyModal(true);
  }
  function openEditCompany(c) {
    setCompanyEdit(c._id);
    setCompanyName(c.name);
    setCompanyModal(true);
  }
  function closeCompanyModal() {
    setCompanyModal(false);
    setCompanyEdit(null);
    setCompanyName("");
  }
  async function saveCompany() {
    if (!companyName.trim()) return toast.error("Name is required.");
    setCompanySaving(true);
    try {
      const url = companyEdit
        ? `/api/companies/${companyEdit}`
        : "/api/companies";
      const res = await fetch(url, {
        method: companyEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: companyName }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || "Failed to save company.");
      toast.success(companyEdit ? "Company updated." : "Company created.");
      closeCompanyModal();
      load();
    } finally {
      setCompanySaving(false);
    }
  }
  async function removeCompany(c) {
    const ok = await confirmDialog(
      `Delete "${c.name}"? Its brands will remain but become unassigned.`,
      { danger: true, confirmLabel: "Delete" },
    );
    if (!ok) return;
    const res = await fetch(`/api/companies/${c._id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Failed to delete company.");
    toast.success("Company deleted.");
    load();
  }

  function openNewBrand(companyId) {
    setBrandModal({ companyId, editId: null, name: "" });
  }
  function openEditBrand(b) {
    setBrandModal({
      companyId: b.company?._id || "",
      editId: b._id,
      name: b.name,
    });
  }
  async function saveBrand() {
    if (!brandModal.name.trim()) return toast.error("Name is required.");
    setBrandSaving(true);
    try {
      const url = brandModal.editId
        ? `/api/brands/${brandModal.editId}`
        : "/api/brands";
      const res = await fetch(url, {
        method: brandModal.editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: brandModal.name,
          company: brandModal.companyId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || "Failed to save brand.");
      toast.success(brandModal.editId ? "Brand updated." : "Brand added.");
      setBrandModal(null);
      load();
    } finally {
      setBrandSaving(false);
    }
  }
  async function removeBrand(b) {
    const ok = await confirmDialog(`Delete "${b.name}"?`, {
      danger: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const res = await fetch(`/api/brands/${b._id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Failed to delete brand.");
    toast.success("Brand deleted.");
    load();
  }

  const brandsByCompany = useMemo(() => {
    const map = {};
    for (const b of brands) {
      const key = b.company?._id || "__unassigned__";
      if (!map[key]) map[key] = [];
      map[key].push(b);
    }
    return map;
  }, [brands]);

  const groupedCompanies = useMemo(() => {
    const groups = {};

    [...companies]
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((company) => {
        const letter = company.name?.trim().charAt(0).toUpperCase() || "#";

        if (!groups[letter]) {
          groups[letter] = [];
        }

        groups[letter].push(company);
      });

    return groups;
  }, [companies]);

  const unassignedBrands = brandsByCompany.__unassigned__ || [];

  function CompanyCard({ company }) {
    const list = brandsByCompany[company._id] || [];
    const c = colorFor(company.name);
    return (
      <div className="card relative flex flex-col overflow-hidden !p-0">
        <div className={`absolute inset-x-0 top-0 h-1.5 ${c.bar}`} />
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 pb-3.5 pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${c.bg} ${c.text}`}
            >
              {company.name.trim().charAt(0).toUpperCase()}
            </div>
            <p className="min-w-0 truncate font-semibold">{company.name}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-panel2 hover:text-neutral-800 dark:hover:text-neutral-200"
              title="Rename"
              onClick={() => openEditCompany(company)}
            >
              ✎
            </button>
            <button
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-panel2 hover:text-red-400"
              title="Delete"
              onClick={() => removeCompany(company)}
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 p-3">
          {list.length === 0 ? (
            <p className="px-1 py-2 text-sm text-neutral-500">No brands yet.</p>
          ) : (
            <BrandGrid list={list} onOpen={(b) => router.push(`/projects?brand=${b._id}`)} onEdit={openEditBrand} onRemove={removeBrand} />
          )}
        </div>
        <div className="border-t border-line p-3">
          <button
            className="btn-ghost w-full !py-2 !text-sm"
            onClick={() => openNewBrand(company._id)}
          >
            + Add brand
          </button>
        </div>
      </div>
    );
  }

  return (
    <Shell user={user} onAdd={openNewCompany}>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Companies</h1>
          <p className="mt-1 text-neutral-500">
            Companies and the brands that sit under them.
          </p>
        </div>
        <button className="btn-primary" onClick={openNewCompany}>
          + New Company
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : companies.length === 0 && unassignedBrands.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="🏢"
            title="No companies yet."
            hint="Create a company, then add brands under it."
            action="+ New Company"
            onAction={openNewCompany}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedCompanies).map(
            ([letter, companiesInGroup]) => (
              <section key={letter}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel2 text-sm font-bold">
                    {letter}
                  </div>

                  <div className="h-px flex-1 bg-line" />

                  <span className="text-xs font-medium text-neutral-400">
                    {companiesInGroup.length}
                    {companiesInGroup.length === 1 ? " company" : " companies"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {companiesInGroup.map((company) => (
                    <CompanyCard key={company._id} company={company} />
                  ))}
                </div>
              </section>
            ),
          )}

          {unassignedBrands.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-line" />
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Unassigned
                </span>
                <div className="h-px flex-1 bg-line" />
              </div>

              <div className="card !p-0">
                <div className="p-3">
                  <BrandGrid
                    list={unassignedBrands}
                    onOpen={(b) => router.push(`/projects?brand=${b._id}`)}
                    onEdit={openEditBrand}
                    onRemove={removeBrand}
                  />
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      <Modal
        open={companyModal}
        onClose={closeCompanyModal}
        title={companyEdit ? "Rename Company" : "New Company"}
      >
        <div className="mb-5">
          <label className="label">Name</label>
          <input
            className="input"
            autoFocus
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveCompany()}
          />
        </div>
        <button
          className="btn-primary w-full"
          onClick={saveCompany}
          disabled={companySaving}
        >
          {companySaving ? "Saving…" : "Save"}
        </button>
      </Modal>

      <Modal
        open={!!brandModal}
        onClose={() => setBrandModal(null)}
        title={brandModal?.editId ? "Rename Brand" : "Add Brand"}
      >
        {brandModal && (
          <>
            <div className="mb-3.5">
              <label className="label">Company</label>
              <select
                className="input"
                value={brandModal.companyId}
                onChange={(e) =>
                  setBrandModal({ ...brandModal, companyId: e.target.value })
                }
              >
                <option value="">Unassigned</option>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-5">
              <label className="label">Name</label>
              <input
                className="input"
                autoFocus
                value={brandModal.name}
                onChange={(e) =>
                  setBrandModal({ ...brandModal, name: e.target.value })
                }
                onKeyDown={(e) => e.key === "Enter" && saveBrand()}
              />
            </div>
            <button
              className="btn-primary w-full"
              onClick={saveBrand}
              disabled={brandSaving}
            >
              {brandSaving ? "Saving…" : "Save"}
            </button>
          </>
        )}
      </Modal>
    </Shell>
  );
}

function BrandGrid({ list, onOpen, onEdit, onRemove }) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {list.map((b) => {
        const bc = colorFor(b.name);
        return (
          <div key={b._id} className="group relative">
            <button className="block w-full" onClick={() => onOpen(b)}>
              <span
                className={`block w-full whitespace-normal break-words rounded-2xl px-3 py-1.5 text-center text-xs font-medium hover:underline ${bc.text} ${bc.bg}`}
              >
                {b.name}
              </span>
            </button>
            <div className="absolute -right-1.5 -top-1.5 hidden items-center gap-0.5 rounded-full border border-line bg-panel px-1 py-0.5 shadow-sm group-hover:flex">
              <button
                className="text-[10px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                onClick={() => onEdit(b)}
              >
                ✎
              </button>
              <button
                className="text-[10px] text-neutral-500 hover:text-red-400"
                onClick={() => onRemove(b)}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
