'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import { TableSkeleton } from '@/components/Skeleton';
import { toast } from '@/lib/toast';

function ProjectsInner() {
    const router = useRouter();
    const params = useSearchParams();
    const brandFilterParam = params.get('brand');

    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [brands, setBrands] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', brand: '' });

    // filters
    const [status, setStatus] = useState('active');
    const [companyFilter, setCompanyFilter] = useState('');
    const [brandFilter, setBrandFilter] = useState(brandFilterParam || '');

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        const me = await fetch('/api/auth/me');
        if (!me.ok) return router.push('/login');
        setUser(await me.json());
        setProjects(await (await fetch('/api/projects')).json());
        setBrands(await (await fetch('/api/brands')).json());
        setCompanies(await (await fetch('/api/companies')).json());
        setLoading(false);
    }

    function openNew() {
        setForm({ name: '', description: '', brand: brandFilter || '' }); setOpen(true);
    }

    function closeModal() {
        setOpen(false);
        setForm({ name: '', description: '', brand: brandFilter || '' });
    }

    async function save() {
        if (!form.name.trim()) return toast.error('Name is required.');
        setSaving(true);
        try {
            const res = await fetch('/api/projects', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) return toast.error('Failed to create project.');
            const created = await res.json();
            closeModal();
            toast.success('Project created — opening it now.');
            router.push(`/projects/${created._id}`);
        } finally {
            setSaving(false);
        }
    }

    const statusPill = (s) => ({
        active: 'bg-green-500/15 text-green-500',
        'on-hold': 'bg-amber-500/15 text-amber-500',
        completed: 'bg-blue-500/15 text-blue-400',
        cancelled: 'bg-red-500/15 text-red-400',
    })[s] || 'bg-neutral-500/15 text-neutral-500';

    const filteredBrands = useMemo(
        () => brands.filter((b) => !companyFilter || b.company?._id === companyFilter),
        [brands, companyFilter]
    );

    const rows = useMemo(() => projects.filter((p) => {
        if (status === 'active' && p.status === 'completed') return false;
        if (status === 'completed' && p.status !== 'completed') return false;
        if (companyFilter && p.company?._id !== companyFilter && p.brand?.company?._id !== companyFilter) return false;
        if (brandFilter && p.brand?._id !== brandFilter) return false;
        if (q && !p.name?.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
    }), [projects, status, companyFilter, brandFilter, q]);

    const hasFilters = status !== 'active' || companyFilter || brandFilter || q;

    return (
        <Shell user={user} onAdd={openNew}>
            <div className="mb-7 flex items-center justify-between">
                <h1 className="text-2xl font-semibold sm:text-3xl">Projects</h1>
                <button className="btn-primary" onClick={openNew}>+ New</button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                    className="input max-w-xs"
                    placeholder="Search projects…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="all">All status</option>
                </select>
                <select
                    className="input w-auto"
                    value={companyFilter}
                    onChange={(e) => { setCompanyFilter(e.target.value); setBrandFilter(''); }}
                >
                    <option value="">All companies</option>
                    {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
                <select className="input w-auto" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
                    <option value="">All brands</option>
                    {filteredBrands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
                {hasFilters && (
                    <button className="btn-ghost" onClick={() => { setStatus('active'); setCompanyFilter(''); setBrandFilter(''); setQ(''); }}>
                        Clear
                    </button>
                )}
            </div>

            <div className="card overflow-x-auto !p-0">
                {loading ? (
                    <TableSkeleton rows={5} cols={5} />
                ) : rows.length === 0 ? (
                    <EmptyState
                        icon="📁"
                        title={hasFilters ? 'No projects match these filters.' : 'No projects yet.'}
                        hint={hasFilters ? undefined : 'Create a project to start its journey — kickoff, design, development and beyond.'}
                        action={hasFilters ? undefined : '+ New Project'}
                        onAction={openNew}
                    />
                ) : (
                    <table className="w-full min-w-[640px] text-sm">
                        <thead>
                            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-neutral-500">
                                <th className="px-4 py-3 font-medium">Name</th>
                                <th className="px-4 py-3 font-medium">Division</th>
                                <th className="px-4 py-3 font-medium">Company</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Deadline</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((p) => (
                                <tr
                                    key={p._id}
                                    className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-panel2/40"
                                    onClick={() => router.push(`/projects/${p._id}`)}
                                >
                                    <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                                        {p.name}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{p.brand?.name || '—'}</td>
                                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{p.company?.name || p.brand?.company?.name || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`rounded-full px-2.5 py-1 text-xs capitalize ${statusPill(p.status)}`}>
                                            {p.status || 'active'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                                        {p.deadline ? new Date(p.deadline).toLocaleDateString() : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Modal open={open} onClose={closeModal} title="New Project">
                <div className="mb-3.5">
                    <label className="label">Name</label>
                    <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="mb-3.5">
                    <label className="label">Division</label>
                    <select className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}>
                        <option value="">None</option>
                        {brands.map((b) => (
                            <option key={b._id} value={b._id}>
                                {b.name}{b.company?.name ? ` · ${b.company.name}` : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="mb-5">
                    <label className="label">Description</label>
                    <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <button className="btn-primary w-full" onClick={save} disabled={saving}>
                    {saving ? 'Creating…' : 'Create & open project →'}
                </button>
            </Modal>
        </Shell>
    );
}

export default function Projects() {
    return <Suspense><ProjectsInner /></Suspense>;
}
