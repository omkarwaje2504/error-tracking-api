'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import { TableSkeleton } from '@/components/Skeleton';
import { toast } from '@/lib/toast';
import { getSession } from '@/lib/session';
import { getReference } from '@/lib/referenceCache';
import { colorFor } from '@/lib/colors';

// Empty string stands for "no product type set" — kept in the hidden-types
// list the same way the API's `excludeTypes` param expects it.
const NO_TYPE = '';

function loadHiddenTypes() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = JSON.parse(localStorage.getItem('projects:hiddenTypes') || '[]');
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

function ProjectsInner() {
    const router = useRouter();
    const params = useSearchParams();
    const brandFilterParam = params.get('brand');

    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [brands, setBrands] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [productTypes, setProductTypes] = useState([]);
    // Product types the user has toggled off — persisted so "hide Rx-pad"
    // sticks across visits instead of resetting every load.
    const [hiddenTypes, setHiddenTypes] = useState(loadHiddenTypes);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [total, setTotal] = useState(0);
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', brand: '' });
    const PAGE_SIZE = 30;

    // filters — applied server-side
    const [status, setStatus] = useState('active');
    const [companyFilter, setCompanyFilter] = useState('');
    const [brandFilter, setBrandFilter] = useState(brandFilterParam || '');
    const [productTypeFilter, setProductTypeFilter] = useState('');

    useEffect(() => { load(); }, [status, companyFilter, brandFilter, productTypeFilter, hiddenTypes]);

    useEffect(() => {
        localStorage.setItem('projects:hiddenTypes', JSON.stringify(hiddenTypes));
    }, [hiddenTypes]);

    function buildQuery(page) {
        const p = new URLSearchParams();
        if (status) p.set('status', status);
        if (companyFilter) p.set('company', companyFilter);
        if (brandFilter) p.set('brand', brandFilter);
        if (productTypeFilter) p.set('productType', productTypeFilter);
        else if (hiddenTypes.length) p.set('excludeTypes', hiddenTypes.join(','));
        p.set('page', String(page));
        p.set('limit', String(PAGE_SIZE));
        return p;
    }

    function toggleType(name) {
        setHiddenTypes((h) => (h.includes(name) ? h.filter((t) => t !== name) : [...h, name]));
    }

    // Picking a specific type to show would otherwise silently conflict
    // with that same type being in the hidden list.
    function selectProductType(name) {
        setProductTypeFilter(name);
        if (name) setHiddenTypes((h) => h.filter((t) => t !== name));
    }

    async function togglePin(e, p) {
        e.stopPropagation(); // don't navigate into the project row
        const pinned = !p.pinned;
        setProjects((list) => list
            .map((x) => (x._id === p._id ? { ...x, pinned } : x))
            .sort((a, b) => (b.pinned === true) - (a.pinned === true)));
        const res = await fetch(`/api/projects/${p._id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pinned }),
        });
        if (!res.ok) {
            toast.error('Failed to update pin.');
            load();
        }
    }

    async function load() {
        setLoading(true);
        const me = await getSession();
        if (!me) return router.push('/login');
        setUser(me);
        const data = await (await fetch(`/api/projects?${buildQuery(1)}`)).json();
        setProjects(data.projects);
        setTotal(data.total);
        setBrands(await getReference('brands'));
        setCompanies(await getReference('companies'));
        setProductTypes(await getReference('productTypes'));
        setLoading(false);
    }

    async function loadMore() {
        setLoadingMore(true);
        const nextPage = Math.floor(projects.length / PAGE_SIZE) + 1;
        const data = await (await fetch(`/api/projects?${buildQuery(nextPage)}`)).json();
        setProjects((p) => [...p, ...data.projects]);
        setLoadingMore(false);
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

    // Status/company/brand are already applied server-side — only the free-text search happens here.
    const rows = useMemo(() => projects.filter((p) => (
        !q || p.name?.toLowerCase().includes(q.toLowerCase())
    )), [projects, q]);

    const typeOptions = useMemo(
        () => [{ _id: '__no-type__', name: 'No type', key: NO_TYPE }, ...productTypes.map((t) => ({ ...t, key: t.name }))],
        [productTypes]
    );

    const hasFilters = status !== 'active' || companyFilter || brandFilter || productTypeFilter || q || hiddenTypes.length > 0;

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
                <select className="input w-auto" value={productTypeFilter} onChange={(e) => selectProductType(e.target.value)}>
                    <option value="">All product types</option>
                    {productTypes.map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}
                </select>
                {hasFilters && (
                    <button className="btn-ghost" onClick={() => { setStatus('active'); setCompanyFilter(''); setBrandFilter(''); setProductTypeFilter(''); setQ(''); setHiddenTypes([]); }}>
                        Clear
                    </button>
                )}
            </div>

            {typeOptions.length > 1 && (
                <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs font-medium uppercase tracking-wider text-neutral-500">Type</span>
                    {typeOptions.map((t) => {
                        const hidden = hiddenTypes.includes(t.key);
                        const c = colorFor(t.name);
                        return (
                            <button
                                key={t._id}
                                type="button"
                                onClick={() => toggleType(t.key)}
                                title={hidden ? `Show "${t.name}" projects` : `Hide "${t.name}" projects`}
                                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                                    hidden
                                        ? 'border-line text-neutral-400 opacity-50 line-through'
                                        : `border-transparent ${c.bg} ${c.text}`
                                }`}
                            >
                                {t.name}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="card overflow-x-auto !p-0">
                {loading ? (
                    <TableSkeleton rows={5} cols={6} />
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
                                <th className="w-8 px-2 py-3 font-medium" aria-hidden />
                                <th className="px-4 py-3 font-medium">Name</th>
                                <th className="px-4 py-3 font-medium">Type</th>
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
                                    <td className="w-8 px-2 py-3 text-center">
                                        <button
                                            type="button"
                                            onClick={(e) => togglePin(e, p)}
                                            title={p.pinned ? 'Unpin' : 'Pin to top'}
                                            className={`text-base leading-none transition ${p.pinned ? 'text-amber-400' : 'text-neutral-300 hover:text-neutral-400 dark:text-neutral-600 dark:hover:text-neutral-500'}`}
                                        >
                                            {p.pinned ? '★' : '☆'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                                        {p.name}
                                    </td>
                                    <td className="px-4 py-3">
                                        {p.projectType ? (
                                            <span className={`rounded-full px-2.5 py-1 text-xs ${colorFor(p.projectType).bg} ${colorFor(p.projectType).text}`}>
                                                {p.projectType}
                                            </span>
                                        ) : '—'}
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

            {!loading && !q && projects.length > 0 && projects.length < total && (
                <div className="mt-4 flex flex-col items-center gap-2">
                    <button className="btn-ghost" onClick={loadMore} disabled={loadingMore}>
                        {loadingMore ? 'Loading…' : `Load more (${projects.length} of ${total})`}
                    </button>
                </div>
            )}

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
