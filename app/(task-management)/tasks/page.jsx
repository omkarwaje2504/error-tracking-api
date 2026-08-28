'use client';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import ProgressModal from '@/components/ProgressModal';
import SubtaskModal from '@/components/SubtaskModal';
import EmptyState from '@/components/EmptyState';
import FileButton from '@/components/FileButton';
import { TableSkeleton } from '@/components/Skeleton';
import { toast } from '@/lib/toast';
import { confirmDialog, promptDialog } from '@/lib/confirm';
import { getSession } from '@/lib/session';
import { getReference } from '@/lib/referenceCache';
import { getTeamSetting, setTeamSetting } from '@/lib/teamSettings';
import { uploadFilesToR2 } from '@/lib/upload';
import { colorFor } from '@/lib/colors';
import { PRIORITY_META, PRIORITY_ORDER, priorityMeta, isOverdue, formatDate, pointsFor, DEPARTMENTS, departmentLabel, statusMeta, canManageTasks } from '@/lib/taskDisplay';

const EMPTY_FORM = {
    title: '', description: '', project: '', assignedTo: [],
    trackProgress: false, unit: '', target: '', department: '',
    priority: 'medium', dueDate: '', attachments: [],
};

// Empty string stands for "no product type set" on the task's project —
// kept in the hidden-types list the same way the API's excludeProductTypes
// param expects it. Same shared setting keys as the Projects list page, so
// hiding a type from either page hides it on both.
const NO_TYPE = '';

function TasksInner() {
    const router = useRouter();
    const params = useSearchParams();
    const projectFilter = params.get('project');

    const [user, setUser] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [users, setUsers] = useState([]);
    const [productTypes, setProductTypes] = useState([]);
    // Shared team preferences — same lead-vs-head-vs-team-member rules as
    // the Projects page. Loaded once in init(); see lib/teamSettings.
    const [hiddenProductTypes, setHiddenProductTypes] = useState([]);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [open, setOpen] = useState(false);
    const [edit, setEdit] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [uploadError, setUploadError] = useState('');
    const [progressTask, setProgressTask] = useState(null);
    const [subtaskParent, setSubtaskParent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [saving, setSaving] = useState(false);
    const [total, setTotal] = useState(0);
    const PAGE_SIZE = 50;

    // filters — applied server-side, not by fetching everything and filtering here
    const [assignee, setAssignee] = useState(params.get('assignee') || '');
    const [status, setStatus] = useState('active');
    const [priority, setPriority] = useState('');
    const [department, setDepartment] = useState('');
    const [productTypeFilter, setProductTypeFilter] = useState('');

    useEffect(() => { init(); }, []);

    // Wait for the shared type-filter settings to load once before the
    // first task fetch, so it doesn't briefly show an unfiltered list.
    useEffect(() => {
        if (!settingsLoaded) return;
        load();
    }, [settingsLoaded, projectFilter, assignee, status, priority, department, productTypeFilter, hiddenProductTypes]);

    function buildQuery(page) {
        const p = new URLSearchParams();
        if (projectFilter) p.set('project', projectFilter);
        if (assignee) p.set('assignee', assignee);
        if (status) p.set('status', status);
        if (priority) p.set('priority', priority);
        if (department) p.set('department', department);
        if (productTypeFilter) p.set('productType', productTypeFilter);
        else if (hiddenProductTypes.length) p.set('excludeProductTypes', hiddenProductTypes.join(','));
        p.set('page', String(page));
        p.set('limit', String(PAGE_SIZE));
        return p;
    }

    async function toggleProductType(name) {
        const next = hiddenProductTypes.includes(name) ? hiddenProductTypes.filter((t) => t !== name) : [...hiddenProductTypes, name];
        setHiddenProductTypes(next);
        if (!(await setTeamSetting('hiddenProductTypes', next))) toast.error('Failed to save.');
    }

    async function selectProductType(name) {
        setProductTypeFilter(name);
        const nextHidden = name ? hiddenProductTypes.filter((t) => t !== name) : hiddenProductTypes;
        if (nextHidden !== hiddenProductTypes) setHiddenProductTypes(nextHidden);
        const ok = await Promise.all([
            setTeamSetting('productTypeFilter', name),
            nextHidden !== hiddenProductTypes ? setTeamSetting('hiddenProductTypes', nextHidden) : Promise.resolve(true),
        ]);
        if (ok.some((x) => !x)) toast.error('Failed to save.');
    }

    async function clearTypeFilters() {
        setProductTypeFilter('');
        setHiddenProductTypes([]);
        const ok = await Promise.all([
            setTeamSetting('productTypeFilter', ''),
            setTeamSetting('hiddenProductTypes', []),
        ]);
        if (ok.some((x) => !x)) toast.error('Failed to save.');
    }

    async function init() {
        const me = await getSession();
        if (!me) return router.push('/login');
        setUser(me);
        const [hidden, shownType] = await Promise.all([
            getTeamSetting('hiddenProductTypes', []),
            getTeamSetting('productTypeFilter', ''),
        ]);
        setHiddenProductTypes(hidden || []);
        setProductTypeFilter(shownType || '');
        setSettingsLoaded(true);
    }

    async function load() {
        setLoading(true);
        const data = await (await fetch(`/api/tasks?${buildQuery(1)}`)).json();
        setTasks(data.tasks);
        setTotal(data.total);
        setProjects(await (await fetch('/api/projects')).json());
        setUsers(await getReference('users'));
        setProductTypes(await getReference('productTypes'));
        setLoading(false);
    }

    async function loadMore() {
        setLoadingMore(true);
        const nextPage = Math.floor(tasks.length / PAGE_SIZE) + 1;
        const data = await (await fetch(`/api/tasks?${buildQuery(nextPage)}`)).json();
        setTasks((t) => [...t, ...data.tasks]);
        setLoadingMore(false);
    }

    function openNew() {
        setEdit(null);
        setUploadError('');
        setForm({ ...EMPTY_FORM, project: projectFilter || '' });
        setOpen(true);
    }

    // Uploads go straight from the browser to R2 — our server only ever
    // hands out a presigned URL, it never sees the file bytes.
    async function uploadFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return [];
        setUploadError('');
        const { uploaded, errors } = await uploadFilesToR2(files);
        if (errors.length) {
            setUploadError(errors.map((e) => `${e.name}: ${e.message}`).join(' · '));
            toast.error(errors.length === files.length ? 'Upload failed.' : 'Some files failed to upload.');
        }
        if (uploaded.length) toast.success(uploaded.length > 1 ? `${uploaded.length} files uploaded.` : 'File uploaded.');
        return uploaded;
    }

    async function save() {
        if (!form.title.trim()) return toast.error('Title is required.');
        if (!form.project) return toast.error('Every task needs a project.');
        if (!form.department) return toast.error('Pick a department.');
        setSaving(true);
        try {
            const url = edit ? `/api/tasks/${edit}` : '/api/tasks';
            const res = await fetch(url, {
                method: edit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) return toast.error('Failed to save task.');
            toast.success(edit ? 'Task updated.' : 'Task created.');
            closeModal(); load();
        } finally {
            setSaving(false);
        }
    }

    // Team members freely toggle pending <-> done themselves. Once a lead
    // has approved a task (completed), it's locked here — only Revert
    // (below) can move it, and that's lead/head-only server-side too.
    async function toggleDone(t) {
        if (t.status === 'completed') return;
        const next = t.status === 'pending' ? 'done' : 'pending';
        const res = await fetch(`/api/tasks/${t._id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: next }),
        });
        if (!res.ok) return toast.error('Failed to update task.');
        toast.success(next === 'done' ? 'Marked done.' : 'Reopened.');
        load();
    }

    async function approve(t) {
        const res = await fetch(`/api/tasks/${t._id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' }),
        });
        const data = await res.json();
        if (!res.ok) return toast.error(data.error || 'Failed to complete task.');
        toast.success('Task marked complete.');
        load();
    }

    async function revert(t) {
        const note = await promptDialog(`Send "${t.title}" back to pending — what needs to change?`, {
            placeholder: 'Feedback for the assignee…', confirmLabel: 'Send back', required: true,
        });
        if (!note) return;
        const res = await fetch(`/api/tasks/${t._id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pending', revertNote: note }),
        });
        const data = await res.json();
        if (!res.ok) return toast.error(data.error || 'Failed to send task back.');
        toast.success('Sent back with feedback.');
        load();
    }

    async function remove(id, title) {
        const ok = await confirmDialog(`Soft delete "${title}"? It can be restored later.`, { danger: true, confirmLabel: 'Delete' });
        if (!ok) return;
        const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        if (!res.ok) return toast.error('Failed to delete task.');
        toast.success('Task deleted.');
        load();
    }

    function toggleAssign(id) {
        setForm((f) => ({
            ...f,
            assignedTo: f.assignedTo.includes(id) ? f.assignedTo.filter((x) => x !== id) : [...f.assignedTo, id],
        }));
    }
    function closeModal() {
        setOpen(false);
        setEdit(null);
        setUploadError('');
        setForm({ ...EMPTY_FORM, project: projectFilter || '' });
    }

    const typeOptions = useMemo(
        () => [{ _id: '__no-type__', name: 'No type', key: NO_TYPE }, ...productTypes.map((t) => ({ ...t, key: t.name }))],
        [productTypes]
    );
    // Only leads and heads get controls for the type filter/hide-list —
    // team-members still see the resulting (lead-set) filtered list, just
    // without a UI to change it. See app/api/settings/route.js.
    const canEditTypes = user?.role === 'lead' || user?.role === 'head';
    const isManager = canManageTasks(user);

    // Status/priority/assignee are already applied server-side — this just orders the current page.
    const rows = useMemo(() => {
        return [...tasks].sort((a, b) => {
            const aOverdue = isOverdue(a), bOverdue = isOverdue(b);
            if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
            const ap = PRIORITY_ORDER[a.priority] ?? 2, bp = PRIORITY_ORDER[b.priority] ?? 2;
            if (ap !== bp) return ap - bp;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }, [tasks]);

    return (
        <Shell user={user} onAdd={openNew}>
            <div className="mb-7 flex items-center justify-between">
                <h1 className="text-2xl font-semibold sm:text-3xl">Tasks</h1>
                <button className="btn-primary" onClick={openNew}>+ New</button>
            </div>
            <ProgressModal
                task={progressTask}
                open={!!progressTask}
                onClose={() => setProgressTask(null)}
                onChange={load}
            />
            <SubtaskModal
                task={subtaskParent}
                users={users}
                open={!!subtaskParent}
                onClose={() => setSubtaskParent(null)}
                onChange={load}
            />

            {/* Filter bar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">Active</option>
                    <option value="done">Done — awaiting review</option>
                    <option value="completed">Completed</option>
                    <option value="all">All status</option>
                </select>
                <select className="input w-auto" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                    <option value="">All assignees</option>
                    {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select>
                <select className="input w-auto" value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="">All priorities</option>
                    {Object.entries(PRIORITY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                </select>
                <select className="input w-auto" value={department} onChange={(e) => setDepartment(e.target.value)}>
                    <option value="">All departments</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{departmentLabel(d)}</option>)}
                </select>
                {canEditTypes && (
                    <select className="input w-auto" value={productTypeFilter} onChange={(e) => selectProductType(e.target.value)}>
                        <option value="">All product types</option>
                        {productTypes.map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}
                    </select>
                )}
                {(status !== 'active' || assignee || priority || department || productTypeFilter || hiddenProductTypes.length > 0) && (
                    <button
                        className="btn-ghost"
                        onClick={() => {
                            setStatus('active'); setAssignee(''); setPriority(''); setDepartment('');
                            if (canEditTypes) clearTypeFilters();
                        }}
                    >
                        Clear
                    </button>
                )}
            </div>

            {canEditTypes && typeOptions.length > 1 && (
                <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs font-medium uppercase tracking-wider text-neutral-500">Hide type</span>
                    {typeOptions.map((t) => {
                        const hidden = hiddenProductTypes.includes(t.key);
                        const c = colorFor(t.name);
                        return (
                            <button
                                key={t._id}
                                type="button"
                                onClick={() => toggleProductType(t.key)}
                                title={hidden ? `Show "${t.name}" tasks` : `Hide "${t.name}" tasks`}
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
                <TableSkeleton rows={6} cols={8} />
              ) : rows.length === 0 ? (
                <EmptyState
                    icon="✅"
                    title={status === 'active' ? 'Nothing active — you\'re all caught up!' : 'No tasks match these filters.'}
                    hint={status === 'active' ? 'New tasks assigned to this scope will show up here.' : undefined}
                    action="+ New Task"
                    onAction={openNew}
                />
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                    <thead>
                        <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-neutral-500">
                            <th className="px-4 py-3 font-medium">Done</th>
                            <th className="px-4 py-3 font-medium">Task</th>
                            <th className="px-4 py-3 font-medium">Project</th>
                            <th className="px-4 py-3 font-medium">Assignees</th>
                            <th className="px-4 py-3 font-medium">Dept</th>
                            <th className="px-4 py-3 font-medium">Priority</th>
                            <th className="px-4 py-3 font-medium">Due</th>
                            <th className="px-4 py-3 font-medium">Created by</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((t) => (
                            <tr key={t._id} className="border-b border-line/60 last:border-0 hover:bg-panel2/40">
                                <td className="px-4 py-3">
                                    {t.trackProgress ? (
                                        <div className="flex flex-col items-start gap-0.5">
                                            <button
                                                className="rounded-full bg-neutral-500/15 px-2.5 py-1 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-500/25"
                                                onClick={() => setProgressTask(t)}
                                            >
                                                {t.progress?.completed || 0}{t.target ? ` / ${t.target}` : ''} {t.unit || ''}
                                            </button>
                                            {t.progress?.declined > 0 && (
                                                <span className="text-[11px] text-red-500">{t.progress.declined} declined</span>
                                            )}
                                        </div>
                                    ) : (
                                        <input
                                            type="checkbox"
                                            className="h-[18px] w-[18px] accent-neutral-900 dark:accent-white disabled:opacity-40"
                                            checked={t.status !== 'pending'}
                                            disabled={t.status === 'completed'}
                                            onChange={() => toggleDone(t)}
                                            title={t.status === 'completed' ? 'Completed — a lead can revert it' : 'Mark done'}
                                        />
                                    )}
                                </td>

                                <td className="px-4 py-3">
                                    <span className={t.status !== 'pending' ? 'text-neutral-500 line-through' : 'font-medium'}>
                                        {t.title}
                                    </span>
                                    {t.status === 'pending' && t.revertNote && (
                                        <p className="mt-0.5 truncate text-xs text-amber-500" title={t.revertNote.text}>
                                            ⚠ {t.revertNote.byName}: {t.revertNote.text}
                                        </p>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                                    {t.project?.name || '—'}
                                    {t.project?.projectType && (
                                        <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[11px] ${colorFor(t.project.projectType).bg} ${colorFor(t.project.projectType).text}`}>
                                            {t.project.projectType}
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                                    {t.assignedTo?.map((u) => u.name).join(', ') || 'Unassigned'}
                                </td>
                                <td className="px-4 py-3 text-neutral-500">{t.department ? departmentLabel(t.department) : '—'}</td>
                                <td className="px-4 py-3">
                                    <span className={`rounded-full px-2.5 py-1 text-xs ${priorityMeta(t.priority).className}`}>
                                        {priorityMeta(t.priority).label}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    {t.dueDate ? (
                                        <span className={isOverdue(t) ? 'font-medium text-red-500' : 'text-neutral-600 dark:text-neutral-400'}>
                                            {formatDate(t.dueDate)}
                                        </span>
                                    ) : <span className="text-neutral-600">—</span>}
                                </td>
                                <td className="px-4 py-3 text-neutral-500">{t.createdBy?.name || '—'}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`rounded-full px-2.5 py-1 text-xs ${statusMeta(t.status).className}`}>
                                            {statusMeta(t.status).label}
                                        </span>
                                        {t.status === 'completed' && (
                                            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">+{pointsFor(t)} pts</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap justify-end gap-2">
                                        {isManager && t.status === 'done' && (
                                            <button className="btn-ghost !px-3 !py-1.5 !text-xs !text-green-500" onClick={() => approve(t)}>✓ Complete</button>
                                        )}
                                        {isManager && (t.status === 'done' || t.status === 'completed') && (
                                            <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => revert(t)}>↩ Revert</button>
                                        )}
                                        <button
                                            className="btn-ghost !px-3 !py-1.5 !text-xs"
                                            onClick={() => setSubtaskParent(t)}
                                        >
                                            Subtasks{t.subCount?.total ? ` (${t.subCount.done}/${t.subCount.total})` : ''}
                                        </button>
                                        <button
                                            className="btn-ghost !px-3 !py-1.5 !text-xs"
                                            onClick={() => {
                                                setEdit(t._id);
                                                setUploadError('');
                                                setForm({
                                                    title: t.title,
                                                    description: t.description || '',
                                                    project: t.project?._id || '',
                                                    assignedTo: t.assignedTo?.map((u) => u._id) || [],
                                                    trackProgress: !!t.trackProgress,
                                                    unit: t.unit || '',
                                                    target: t.target ?? '',
                                                    department: t.department || '',
                                                    priority: t.priority || 'medium',
                                                    dueDate: t.dueDate ? String(t.dueDate).slice(0, 10) : '',
                                                    attachments: t.attachments || [],
                                                });
                                                setOpen(true);
                                            }}
                                        >
                                            Edit
                                        </button>
                                        <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => remove(t._id, t.title)}>Delete</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              )}
            </div>

            {!loading && tasks.length > 0 && tasks.length < total && (
                <div className="mt-4 flex flex-col items-center gap-2">
                    <button className="btn-ghost" onClick={loadMore} disabled={loadingMore}>
                        {loadingMore ? 'Loading…' : `Load more (${tasks.length} of ${total})`}
                    </button>
                </div>
            )}

            <Modal open={open} onClose={closeModal} title={edit ? 'Edit Task' : 'New Task'}>
                <div className="mb-3.5">
                    <label className="label">Title</label>
                    <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="mb-3.5">
                    <label className="label">Description</label>
                    <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="mb-3.5">
                    <label className="label">Project</label>
                    <select className="input" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}>
                        <option value="" disabled>Select a project…</option>
                        {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                    <p className="mt-1 text-xs text-neutral-500">Every task belongs to a project — pick one above.</p>
                </div>
                <div className="mb-3.5 flex gap-3">
                    <div className="flex-1">
                        <label className="label">Department</label>
                        <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                            <option value="" disabled>Select a department…</option>
                            {DEPARTMENTS.map((d) => <option key={d} value={d}>{departmentLabel(d)}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="label">Priority</label>
                        <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                            {Object.entries(PRIORITY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                        </select>
                    </div>
                </div>
                <div className="mb-3.5">
                    <label className="label">Due date (optional)</label>
                    <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>
                <div className="mb-3.5">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                        <input
                            type="checkbox"
                            className="h-4 w-4 accent-neutral-900 dark:accent-white"
                            checked={form.trackProgress}
                            onChange={(e) => setForm({ ...form, trackProgress: e.target.checked })}
                        />
                        Track daily quantity (e.g. RxPad)
                    </label>
                </div>

                {form.trackProgress && (
                    <div className="mb-5 flex gap-3">
                        <div className="flex-1">
                            <label className="label">Unit</label>
                            <input className="input" placeholder="RxPad" value={form.unit}
                                onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                        </div>
                        <div className="flex-1">
                            <label className="label">Target (optional)</label>
                            <input className="input" type="number" placeholder="500" value={form.target}
                                onChange={(e) => setForm({ ...form, target: e.target.value })} />
                        </div>
                    </div>
                )}
                <div className="mb-5">
                    <label className="label">Assign To (multiple)</label>
                    <div className="flex flex-wrap gap-2">
                        {users.map((u) => (
                            <button
                                key={u._id}
                                onClick={() => toggleAssign(u._id)}
                                className={`rounded-full border border-line px-3 py-1.5 text-sm transition-colors ${form.assignedTo.includes(u._id) ? 'bg-neutral-900 text-white dark:bg-white dark:text-black' : 'bg-panel2 text-neutral-900 dark:text-neutral-100'
                                    }`}
                            >
                                {u.name}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="mb-5">
                    <div className="mb-2 flex items-center justify-between">
                        <label className="label !mb-0">Attachments</label>
                        <FileButton
                            label="Attach files"
                            multiple
                            onFiles={async (files) => {
                                const uploaded = await uploadFiles(files);
                                if (uploaded.length) setForm((f) => ({ ...f, attachments: [...f.attachments, ...uploaded] }));
                            }}
                        />
                    </div>
                    {uploadError && (
                        <p className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{uploadError}</p>
                    )}
                    {form.attachments.length > 0 && (
                        <ul className="space-y-1">
                            {form.attachments.map((a, i) => (
                                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                                    <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-neutral-700 hover:underline dark:text-neutral-300">{a.name}</a>
                                    <button
                                        className="shrink-0 text-xs text-neutral-500 hover:text-red-400"
                                        onClick={() => setForm((f) => ({ ...f, attachments: f.attachments.filter((_, idx) => idx !== i) }))}
                                    >✕</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <button className="btn-primary w-full" onClick={save} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </Modal>
        </Shell>
    );
}

export default function Tasks() {
    return <Suspense><TasksInner /></Suspense>;
}
