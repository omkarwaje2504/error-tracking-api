'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import { CardSkeleton } from '@/components/Skeleton';
import { toast } from '@/lib/toast';
import { confirmDialog } from '@/lib/confirm';
import { colorFor } from '@/lib/colors';

export default function CompaniesAndBrands() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');

    const [companyModal, setCompanyModal] = useState(false);
    const [companyEdit, setCompanyEdit] = useState(null);
    const [companyName, setCompanyName] = useState('');
    const [companySaving, setCompanySaving] = useState(false);

    const [brandModal, setBrandModal] = useState(null); // { companyId, editId, name }
    const [brandSaving, setBrandSaving] = useState(false);

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        const me = await fetch('/api/auth/me');
        if (!me.ok) return router.push('/login');
        setUser(await me.json());
        setCompanies(await (await fetch('/api/companies')).json());
        setBrands(await (await fetch('/api/brands')).json());
        setLoading(false);
    }

    function openNewCompany() {
        setCompanyEdit(null); setCompanyName(''); setCompanyModal(true);
    }
    function openEditCompany(c) {
        setCompanyEdit(c._id); setCompanyName(c.name); setCompanyModal(true);
    }
    function closeCompanyModal() {
        setCompanyModal(false); setCompanyEdit(null); setCompanyName('');
    }
    async function saveCompany() {
        if (!companyName.trim()) return toast.error('Name is required.');
        setCompanySaving(true);
        try {
            const url = companyEdit ? `/api/companies/${companyEdit}` : '/api/companies';
            const res = await fetch(url, {
                method: companyEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: companyName }),
            });
            const data = await res.json();
            if (!res.ok) return toast.error(data.error || 'Failed to save company.');
            toast.success(companyEdit ? 'Company updated.' : 'Company created.');
            closeCompanyModal(); load();
        } finally {
            setCompanySaving(false);
        }
    }
    async function removeCompany(c) {
        const ok = await confirmDialog(`Delete "${c.name}"? Its brands will remain but become unassigned.`, { danger: true, confirmLabel: 'Delete' });
        if (!ok) return;
        const res = await fetch(`/api/companies/${c._id}`, { method: 'DELETE' });
        if (!res.ok) return toast.error('Failed to delete company.');
        toast.success('Company deleted.');
        load();
    }

    function openNewBrand(companyId) {
        setBrandModal({ companyId, editId: null, name: '' });
    }
    function openEditBrand(b) {
        setBrandModal({ companyId: b.company?._id || '', editId: b._id, name: b.name });
    }
    async function saveBrand() {
        if (!brandModal.name.trim()) return toast.error('Name is required.');
        setBrandSaving(true);
        try {
            const url = brandModal.editId ? `/api/brands/${brandModal.editId}` : '/api/brands';
            const res = await fetch(url, {
                method: brandModal.editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: brandModal.name, company: brandModal.companyId || null }),
            });
            const data = await res.json();
            if (!res.ok) return toast.error(data.error || 'Failed to save brand.');
            toast.success(brandModal.editId ? 'Brand updated.' : 'Brand added.');
            setBrandModal(null); load();
        } finally {
            setBrandSaving(false);
        }
    }
    async function removeBrand(b) {
        const ok = await confirmDialog(`Delete "${b.name}"?`, { danger: true, confirmLabel: 'Delete' });
        if (!ok) return;
        const res = await fetch(`/api/brands/${b._id}`, { method: 'DELETE' });
        if (!res.ok) return toast.error('Failed to delete brand.');
        toast.success('Brand deleted.');
        load();
    }

    const brandsByCompany = useMemo(() => {
        const map = {};
        for (const b of brands) {
            const key = b.company?._id || '__unassigned__';
            if (!map[key]) map[key] = [];
            map[key].push(b);
        }
        return map;
    }, [brands]);

    const filteredCompanies = useMemo(() => {
        if (!q) return companies;
        const ql = q.toLowerCase();
        return companies.filter((c) =>
            c.name.toLowerCase().includes(ql) ||
            (brandsByCompany[c._id] || []).some((b) => b.name.toLowerCase().includes(ql))
        );
    }, [companies, brandsByCompany, q]);

    const unassignedBrands = (brandsByCompany.__unassigned__ || []).filter(
        (b) => !q || b.name.toLowerCase().includes(q.toLowerCase())
    );

    function CompanyCard({ company }) {
        const list = brandsByCompany[company._id] || [];
        const c = colorFor(company.name);
        return (
            <div className="card relative flex flex-col overflow-hidden !p-0">
                <div className={`absolute inset-x-0 top-0 h-1.5 ${c.bar}`} />
                <div className="flex items-center justify-between gap-2 border-b border-line px-4 pb-3.5 pt-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${c.bg} ${c.text}`}>
                            {company.name.trim().charAt(0).toUpperCase()}
                        </div>
                        <p className="min-w-0 truncate font-semibold">{company.name}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                        <button className="rounded-lg p-1.5 text-neutral-500 hover:bg-panel2 hover:text-neutral-800 dark:hover:text-neutral-200" title="Rename" onClick={() => openEditCompany(company)}>
                            ✎
                        </button>
                        <button className="rounded-lg p-1.5 text-neutral-500 hover:bg-panel2 hover:text-red-400" title="Delete" onClick={() => removeCompany(company)}>
                            ✕
                        </button>
                    </div>
                </div>
                <div className="flex-1 space-y-1.5 p-3">
                    {list.length === 0 ? (
                        <p className="px-1 py-2 text-sm text-neutral-500">No brands yet.</p>
                    ) : (
                        list.map((b) => {
                            const bc = colorFor(b.name);
                            return (
                                <div key={b._id} className="group flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm hover:bg-panel2/60">
                                    <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => router.push(`/projects?brand=${b._id}`)}>
                                        <span className={`h-2 w-2 shrink-0 rounded-full ${bc.bar}`} />
                                        <span className="min-w-0 truncate font-medium hover:underline">{b.name}</span>
                                    </button>
                                    <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                        <button className="rounded-md px-1.5 py-0.5 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200" onClick={() => openEditBrand(b)}>✎</button>
                                        <button className="rounded-md px-1.5 py-0.5 text-xs text-neutral-500 hover:text-red-400" onClick={() => removeBrand(b)}>✕</button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="border-t border-line p-3">
                    <button className="btn-ghost w-full !py-2 !text-sm" onClick={() => openNewBrand(company._id)}>
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
                    <p className="mt-1 text-neutral-500">Companies and the brands that sit under them.</p>
                </div>
                <button className="btn-primary" onClick={openNewCompany}>+ New Company</button>
            </div>

            <div className="mb-6">
                <input
                    className="input max-w-xs"
                    placeholder="Search companies or brands…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
            ) : filteredCompanies.length === 0 && unassignedBrands.length === 0 ? (
                <div className="card">
                    <EmptyState
                        icon="🏢"
                        title={q ? 'Nothing matches your search.' : 'No companies yet.'}
                        hint={q ? undefined : 'Create a company, then add brands under it.'}
                        action={q ? undefined : '+ New Company'}
                        onAction={openNewCompany}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredCompanies.map((c) => <CompanyCard key={c._id} company={c} />)}
                    {unassignedBrands.length > 0 && (
                        <div className="card flex flex-col !p-0">
                            <div className="border-b border-line px-4 py-3.5">
                                <p className="font-semibold text-neutral-500">Unassigned brands</p>
                            </div>
                            <div className="flex-1 space-y-1.5 p-3">
                                {unassignedBrands.map((b) => (
                                    <div key={b._id} className="group flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm hover:bg-panel2/60">
                                        <button className="min-w-0 flex-1 truncate text-left font-medium hover:underline" onClick={() => router.push(`/projects?brand=${b._id}`)}>
                                            {b.name}
                                        </button>
                                        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            <button className="rounded-md px-1.5 py-0.5 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200" onClick={() => openEditBrand(b)}>✎</button>
                                            <button className="rounded-md px-1.5 py-0.5 text-xs text-neutral-500 hover:text-red-400" onClick={() => removeBrand(b)}>✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <Modal open={companyModal} onClose={closeCompanyModal} title={companyEdit ? 'Rename Company' : 'New Company'}>
                <div className="mb-5">
                    <label className="label">Name</label>
                    <input
                        className="input" autoFocus
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveCompany()}
                    />
                </div>
                <button className="btn-primary w-full" onClick={saveCompany} disabled={companySaving}>
                    {companySaving ? 'Saving…' : 'Save'}
                </button>
            </Modal>

            <Modal open={!!brandModal} onClose={() => setBrandModal(null)} title={brandModal?.editId ? 'Rename Brand' : 'Add Brand'}>
                {brandModal && (
                    <>
                        <div className="mb-3.5">
                            <label className="label">Company</label>
                            <select
                                className="input"
                                value={brandModal.companyId}
                                onChange={(e) => setBrandModal({ ...brandModal, companyId: e.target.value })}
                            >
                                <option value="">Unassigned</option>
                                {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="mb-5">
                            <label className="label">Name</label>
                            <input
                                className="input" autoFocus
                                value={brandModal.name}
                                onChange={(e) => setBrandModal({ ...brandModal, name: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && saveBrand()}
                            />
                        </div>
                        <button className="btn-primary w-full" onClick={saveBrand} disabled={brandSaving}>
                            {brandSaving ? 'Saving…' : 'Save'}
                        </button>
                    </>
                )}
            </Modal>
        </Shell>
    );
}
