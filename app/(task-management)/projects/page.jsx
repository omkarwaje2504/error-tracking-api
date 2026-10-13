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
import { getTeamSetting, setTeamSetting } from '@/lib/teamSettings';
import { colorFor } from '@/lib/colors';
import { PROJECT_STAGES, projectStageLabel, projectStageClassName } from '@/lib/projectStages';
import SortableTh, { nextMultiSort, compareMulti } from '@/components/SortableTh';

// Empty string stands for "no product type set" — kept in the hidden-types
// list the same way the API's `excludeTypes` param expects it.
const NO_TYPE = '';

const STATUS_OPTIONS = ['active', 'on-hold', 'completed', 'cancelled'];

// Column key -> label, in header order; drives the "then by…" picker.
const SORT_LABELS = {
    name: 'Name', type: 'Type', division: 'Division', company: 'Company',
    stage: 'Stage', status: 'Status', deadline: 'Deadline',
};

// Search/filters/sort survive opening a project and coming back (per browser
// tab). Restored in init() before the first fetch so the list loads once.
const VIEW_KEY = 'projects:view';

function readView() {
    try { return JSON.parse(sessionStorage.getItem(VIEW_KEY)) || {}; } catch { return {}; }
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
    // Shared team preferences (see lib/teamSettings) — a lead's edits are
    // the one value every team-member sees; a head's edits are private to
    // them. Loaded once settingsLoaded flips true; see init().
    const [hiddenTypes, setHiddenTypes] = useState([]);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
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
    const [stageFilter, setStageFilter] = useState('');
    const [sort, setSort] = useState([]);

    useEffect(() => { init(); }, []);

    useEffect(() => {
        if (!settingsLoaded) return; // don't clobber the saved view with defaults
        try {
            sessionStorage.setItem(VIEW_KEY, JSON.stringify({ q, status, companyFilter, brandFilter, stageFilter, sort }));
        } catch { /* storage unavailable — view just won't persist */ }
    }, [settingsLoaded, q, status, companyFilter, brandFilter, stageFilter, sort]);

    // Don't fetch the project list until the shared type-filter settings
    // have loaded once — otherwise the first fetch runs with hiddenTypes/
    // productTypeFilter still at their empty defaults and briefly shows
    // everything before the real (possibly filtered) list replaces it.
    useEffect(() => {
        if (!settingsLoaded) return;
        load();
    }, [settingsLoaded, status, companyFilter, brandFilter, stageFilter, productTypeFilter, hiddenTypes]);

    function buildQuery(page) {
        const p = new URLSearchParams();
        if (status) p.set('status', status);
        if (companyFilter) p.set('company', companyFilter);
        if (brandFilter) p.set('brand', brandFilter);
        if (stageFilter) p.set('stage', stageFilter);
        if (productTypeFilter) p.set('productType', productTypeFilter);
        else if (hiddenTypes.length) p.set('excludeTypes', hiddenTypes.join(','));
        p.set('page', String(page));
        p.set('limit', String(PAGE_SIZE));
        return p;
    }

    async function toggleType(name) {
        const next = hiddenTypes.includes(name) ? hiddenTypes.filter((t) => t !== name) : [...hiddenTypes, name];
        setHiddenTypes(next);
        if (!(await setTeamSetting('hiddenProductTypes', next))) toast.error('Failed to save.');
    }

    // Picking a specific type to show would otherwise silently conflict
    // with that same type being in the hidden list.
    async function selectProductType(name) {
        setProductTypeFilter(name);
        const nextHidden = name ? hiddenTypes.filter((t) => t !== name) : hiddenTypes;
        if (nextHidden !== hiddenTypes) setHiddenTypes(nextHidden);
        const ok = await Promise.all([
            setTeamSetting('productTypeFilter', name),
            nextHidden !== hiddenTypes ? setTeamSetting('hiddenProductTypes', nextHidden) : Promise.resolve(true),
        ]);
        if (ok.some((x) => !x)) toast.error('Failed to save.');
    }

    async function clearTypeFilters() {
        setProductTypeFilter('');
        setHiddenTypes([]);
        const ok = await Promise.all([
            setTeamSetting('productTypeFilter', ''),
            setTeamSetting('hiddenProductTypes', []),
        ]);
        if (ok.some((x) => !x)) toast.error('Failed to save.');
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

    async function updateStage(e, p, currentStage) {
        e.stopPropagation(); // don't navigate into the project row
        // Drop the row if it no longer matches the stage filter.
        const matches = !stageFilter || stageFilter === (currentStage || 'none');
        setProjects((list) => (matches
            ? list.map((x) => (x._id === p._id ? { ...x, currentStage } : x))
            : list.filter((x) => x._id !== p._id)));
        if (!matches) setTotal((t) => t - 1);
        const res = await fetch(`/api/projects/${p._id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentStage }),
        });
        if (!res.ok) {
            toast.error('Failed to update stage.');
            load();
        }
    }

    async function updateStatus(p, status) {
        // Drop the row if it no longer matches the status filter (e.g. closing
        // a project while viewing Active) — mirrors the server-side match.
        const matches = status === 'completed' ? statusFilterAllowsCompleted : statusFilterAllowsOpen;
        setProjects((list) => (matches
            ? list.map((x) => (x._id === p._id ? { ...x, status } : x))
            : list.filter((x) => x._id !== p._id)));
        if (!matches) setTotal((t) => t - 1);
        const res = await fetch(`/api/projects/${p._id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        if (!res.ok) {
            toast.error('Failed to update status.');
            return load();
        }
        toast.success(`"${p.name}" marked ${status}.`);
    }

    async function init() {
        const me = await getSession();
        if (!me) return router.push('/login');
        setUser(me);
        const [hidden, shownType] = await Promise.all([
            getTeamSetting('hiddenProductTypes', []),
            getTeamSetting('productTypeFilter', ''),
        ]);
        setHiddenTypes(hidden || []);
        setProductTypeFilter(shownType || '');
        const view = readView();
        if (typeof view.q === 'string') setQ(view.q);
        if (view.status) setStatus(view.status);
        if (view.stageFilter) setStageFilter(view.stageFilter);
        if (Array.isArray(view.sort)) setSort(view.sort);
        // A ?brand= link (e.g. from a brand page) wins over the saved company/brand.
        if (!brandFilterParam) {
            if (view.companyFilter) setCompanyFilter(view.companyFilter);
            if (view.brandFilter) setBrandFilter(view.brandFilter);
        }
        setSettingsLoaded(true);
    }

    async function load() {
        setLoading(true);
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

    const statusFilterAllowsCompleted = status !== 'active';
    const statusFilterAllowsOpen = status !== 'completed';

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

    // Status/company/brand are already applied server-side — only the free-text
    // search happens here, plus sort when a column's explicitly picked (the
    // server already sorts pinned-first/newest by default; reset returns to that).
    const rows = useMemo(() => {
        const filtered = projects.filter((p) => !q || p.name?.toLowerCase().includes(q.toLowerCase()));
        if (!sort.length) return filtered;
        const val = (p, key) => {
            switch (key) {
                case 'name': return p.name?.toLowerCase() || '';
                case 'type': return p.projectType?.toLowerCase() || '';
                case 'division': return p.brand?.name?.toLowerCase() || '';
                case 'company': return (p.company?.name || p.brand?.company?.name || '').toLowerCase();
                case 'stage': return p.currentStage || '';
                case 'status': return p.status || '';
                case 'deadline': return p.deadline ? new Date(p.deadline).getTime() : null;
                default: return '';
            }
        };
        return [...filtered].sort((a, b) => compareMulti(a, b, sort, val));
    }, [projects, q, sort]);

    const onSort = (k, additive) => setSort((s) => nextMultiSort(s, k, additive));
    const toggleSortDir = (k) => setSort((s) => s.map((x) => (x.key === k ? { ...x, dir: x.dir === 'asc' ? 'desc' : 'asc' } : x)));
    const removeSort = (k) => setSort((s) => s.filter((x) => x.key !== k));

    const typeOptions = useMemo(
        () => [{ _id: '__no-type__', name: 'No type', key: NO_TYPE }, ...productTypes.map((t) => ({ ...t, key: t.name }))],
        [productTypes]
    );

    const hasFilters = status !== 'active' || companyFilter || brandFilter || stageFilter || productTypeFilter || q || hiddenTypes.length > 0;
    // Only leads and heads get controls for the type filter/hide-list —
    // team-members still see the resulting (lead-set) filtered list, just
    // without a UI to change it. See app/api/settings/route.js.
    const canEditTypes = user?.role === 'lead' || user?.role === 'head';

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
                <select className="input w-auto" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                    <option value="">All stages</option>
                    {PROJECT_STAGES.map((s) => <option key={s} value={s}>{projectStageLabel(s)}</option>)}
                    <option value="none">Not set</option>
                </select>
                {canEditTypes && (
                    <select className="input w-auto" value={productTypeFilter} onChange={(e) => selectProductType(e.target.value)}>
                        <option value="">All product types</option>
                        {productTypes.map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}
                    </select>
                )}
                {hasFilters && (
                    <button
                        className="btn-ghost"
                        onClick={() => {
                            setStatus('active'); setCompanyFilter(''); setBrandFilter(''); setStageFilter(''); setQ('');
                            if (canEditTypes) clearTypeFilters();
                        }}
                    >
                        Clear
                    </button>
                )}
            </div>

            {canEditTypes && typeOptions.length > 1 && (
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

            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="mr-1 font-medium uppercase tracking-wider text-neutral-500">Sort</span>
                {sort.length === 0 ? (
                    <span className="text-neutral-500">Default · click a column header; Shift+click to add another level</span>
                ) : (
                    <>
                        {sort.map((s, i) => (
                            <span key={s.key} className="inline-flex items-center gap-1">
                                {i > 0 && <span className="text-neutral-400">then</span>}
                                <span className="inline-flex items-center rounded-full border border-line bg-panel2/40">
                                    <button
                                        type="button"
                                        className="px-2.5 py-1"
                                        title="Toggle ascending / descending"
                                        onClick={() => toggleSortDir(s.key)}
                                    >
                                        {SORT_LABELS[s.key]} {s.dir === 'asc' ? '↑' : '↓'}
                                    </button>
                                    <button
                                        type="button"
                                        className="pr-2 text-neutral-400 hover:text-red-400"
                                        title="Remove this sort level"
                                        onClick={() => removeSort(s.key)}
                                    >
                                        ×
                                    </button>
                                </span>
                            </span>
                        ))}
                        <select
                            className="input w-auto !py-1 text-xs"
                            value=""
                            onChange={(e) => e.target.value && onSort(e.target.value, true)}
                        >
                            <option value="">+ then by…</option>
                            {Object.entries(SORT_LABELS)
                                .filter(([k]) => !sort.some((s) => s.key === k))
                                .map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                        <button type="button" className="btn-ghost !py-1 text-xs" onClick={() => setSort([])}>Reset</button>
                    </>
                )}
            </div>

            <div className="card overflow-x-auto !p-0">
                {loading ? (
                    <TableSkeleton rows={5} cols={7} />
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
                                <SortableTh sortKey="name" label="Name" sort={sort} onSort={onSort} />
                                <SortableTh sortKey="type" label="Type" sort={sort} onSort={onSort} />
                                <SortableTh sortKey="division" label="Division" sort={sort} onSort={onSort} />
                                <SortableTh sortKey="company" label="Company" sort={sort} onSort={onSort} />
                                <SortableTh sortKey="stage" label="Stage" sort={sort} onSort={onSort} />
                                <SortableTh sortKey="status" label="Status" sort={sort} onSort={onSort} />
                                <SortableTh sortKey="deadline" label="Deadline" sort={sort} onSort={onSort} />
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
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                        <select
                                            className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${projectStageClassName(p.currentStage)}`}
                                            value={p.currentStage || ''}
                                            onChange={(e) => updateStage(e, p, e.target.value)}
                                        >
                                            <option value="">Not set</option>
                                            {PROJECT_STAGES.map((s) => <option key={s} value={s}>{projectStageLabel(s)}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                        <select
                                            className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium capitalize ${statusPill(p.status)}`}
                                            value={p.status || 'active'}
                                            onChange={(e) => updateStatus(p, e.target.value)}
                                            title="Change project status"
                                        >
                                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                        </select>
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
