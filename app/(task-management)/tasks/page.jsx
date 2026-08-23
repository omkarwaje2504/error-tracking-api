'use client';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import ProgressModal from '@/components/ProgressModal';
import SubtaskModal from '@/components/SubtaskModal';
import EmptyState from '@/components/EmptyState';
import { TableSkeleton } from '@/components/Skeleton';
import { toast } from '@/lib/toast';
import { confirmDialog } from '@/lib/confirm';
import { PRIORITY_META, PRIORITY_ORDER, priorityMeta, isOverdue, formatDate } from '@/lib/taskDisplay';

function TasksInner() {
    const router = useRouter();
    const params = useSearchParams();
    const projectFilter = params.get('project');

    const [user, setUser] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [users, setUsers] = useState([]);
    const [open, setOpen] = useState(false);
    const [edit, setEdit] = useState(null);
    const [form, setForm] = useState({
        title: '', description: '', project: '', assignedTo: [],
        trackProgress: false, unit: '', target: '', department: '',
        priority: 'medium', dueDate: '',
    });
    const [progressTask, setProgressTask] = useState(null);
    const [subtaskParent, setSubtaskParent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // filters
    const [assignee, setAssignee] = useState(params.get('assignee') || '');
    const [status, setStatus] = useState('active');
    const [priority, setPriority] = useState('');

    useEffect(() => { load(); }, [projectFilter, assignee]);

    async function load() {
        setLoading(true);
        const me = await fetch('/api/auth/me');
        if (!me.ok) return router.push('/login');
        setUser(await me.json());

        const p = new URLSearchParams();
        if (projectFilter) p.set('project', projectFilter);
        if (assignee) p.set('assignee', assignee);
        const url = `/api/tasks${p.toString() ? `?${p}` : ''}`;

        setTasks(await (await fetch(url)).json());
        setProjects(await (await fetch('/api/projects')).json());
        setUsers(await (await fetch('/api/users')).json());
        setLoading(false);
    }

    function openNew() {
        setEdit(null);
        setForm({
            title: '', description: '', project: projectFilter || '', assignedTo: [],
            trackProgress: false, unit: '', target: '', department: '',
            priority: 'medium', dueDate: '',
        });
        setOpen(true);
    }

    async function save() {
        if (!form.title.trim()) return toast.error('Title is required.');
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

    async function toggle(t) {
        await fetch(`/api/tasks/${t._id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: t.status === 'pending' ? 'completed' : 'pending' }),
        });
        toast.success(t.status === 'pending' ? 'Task marked complete.' : 'Task reopened.');
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
        setForm({
            title: '', description: '', project: projectFilter || '', assignedTo: [],
            trackProgress: false, unit: '', target: '', department: '',
            priority: 'medium', dueDate: '',
        });
    }

    const rows = useMemo(() => {
        const r = tasks.filter((t) => {
            if (status === 'active' && t.status !== 'pending') return false;
            if (status === 'completed' && t.status !== 'completed') return false;
            if (priority && t.priority !== priority) return false;
            return true;
        });
        return [...r].sort((a, b) => {
            const aOverdue = isOverdue(a), bOverdue = isOverdue(b);
            if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
            const ap = PRIORITY_ORDER[a.priority] ?? 2, bp = PRIORITY_ORDER[b.priority] ?? 2;
            if (ap !== bp) return ap - bp;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }, [tasks, status, priority]);

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
                {(status !== 'active' || assignee || priority) && (
                    <button className="btn-ghost" onClick={() => { setStatus('active'); setAssignee(''); setPriority(''); }}>
                        Clear
                    </button>
                )}
            </div>

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
                                        <span className={`rounded-full px-2.5 py-1 text-xs ${t.status === 'completed' ? 'bg-green-500/15 text-green-400' : 'bg-neutral-500/15 text-neutral-500'
                                            }`}>
                                            {t.status}
                                        </span>
                                    )}
                                </td>

                                <td className="px-4 py-3">
                                    <span className={t.status === 'completed' ? 'text-neutral-500 line-through' : 'font-medium'}>
                                        {t.title}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.project?.name || '—'}</td>
                                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                                    {t.assignedTo?.map((u) => u.name).join(', ') || 'Unassigned'}
                                </td>
                                <td className="px-4 py-3 text-neutral-500 capitalize">{t.department || '—'}</td>
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
                                    <span className={`rounded-full px-2.5 py-1 text-xs ${t.status === 'completed'
                                        ? 'bg-green-500/15 text-green-400'
                                        : 'bg-neutral-500/15 text-neutral-500'
                                        }`}>
                                        {t.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-2">
                                        <input type="checkbox" className="mt-1.5 mr-4 h-[18px] w-[18px] accent-neutral-900 dark:accent-white"
                                            checked={t.status === 'completed'} onChange={() => toggle(t)} />
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
                        <option value="">No project (global task)</option>
                        {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                </div>
                <div className="mb-3.5 flex gap-3">
                    <div className="flex-1">
                        <label className="label">Department</label>
                        <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                            <option value="">None</option>
                            <option value="graphic">Graphic</option>
                            <option value="video">Video</option>
                            <option value="frontend">Frontend</option>
                            <option value="backend">Backend</option>
                            <option value="app">App</option>
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
