'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import ProgressModal from '@/components/ProgressModal';
import DailyReportModal from '@/components/DailyReportModal';
import EmptyState from '@/components/EmptyState';
import { TableSkeleton } from '@/components/Skeleton';
import { toast } from '@/lib/toast';
import { getSession } from '@/lib/session';
import { priorityMeta, isOverdue, formatDate, pointsFor } from '@/lib/taskDisplay';

export default function Dashboard() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    // filters
    const [status, setStatus] = useState('active');
    const [q, setQ] = useState('');
    const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });

    const [progressTask, setProgressTask] = useState(null);
    const [reportOpen, setReportOpen] = useState(false);

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        const me = await getSession();
        if (!me) return router.push('/login');
        setUser(me);

        setTasks(await (await fetch('/api/tasks?mine=true')).json());
        setProjects(await (await fetch('/api/projects')).json());
        setLoading(false);
    }

    const isManager = user?.role === 'lead' || user?.role === 'head';

    async function complete(t) {
        const res = await fetch(`/api/tasks/${t._id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: t.status === 'completed' ? 'pending' : 'completed' }),
        });
        if (!res.ok) return toast.error('Failed to update task.');
        toast.success(t.status === 'completed' ? 'Task reopened.' : 'Task marked complete.');
        load();
    }

    // client-side status + search + sort ("mine" scope is already applied server-side)
    const rows = useMemo(() => {
        let r = tasks.filter((t) => {
            if (status === 'active' && t.status !== 'pending') return false;
            if (status === 'completed' && t.status !== 'completed') return false;
            if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
            return true;
        });
        const val = (t) => {
            switch (sort.key) {
                case 'title': return t.title?.toLowerCase() || '';
                case 'project': return t.project?.name?.toLowerCase() || '';
                case 'status': return t.status || '';
                default: return t.createdAt || '';
            }
        };
        r = [...r].sort((a, b) => {
            const av = val(a), bv = val(b);
            if (av < bv) return sort.dir === 'asc' ? -1 : 1;
            if (av > bv) return sort.dir === 'asc' ? 1 : -1;
            return 0;
        });
        return r;
    }, [tasks, status, q, sort]);

    function th(key, label) {
        const active = sort.key === key;
        return (
            <th
                className="cursor-pointer select-none px-4 py-3 font-medium hover:text-neutral-800 dark:hover:text-neutral-300"
                onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}
            >
                {label}{active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
            </th>
        );
    }

    const pending = tasks.filter((t) => t.status === 'pending').length;
    const done = tasks.filter((t) => t.status === 'completed').length;
    const overdue = tasks.filter(isOverdue).length;
    const qtyDone = tasks.reduce((s, t) => s + (t.progress?.completed || 0), 0);
    const qtyPending = tasks.reduce((s, t) => s + ((t.progress?.added || 0) - (t.progress?.completed || 0)), 0);

    const stats = [
        { label: 'Pending', value: pending },
        { label: 'Overdue', value: overdue, accent: overdue > 0 ? 'text-red-500' : '' },
        { label: 'Completed', value: done, accent: 'text-green-500' },
        { label: 'Qty done', value: qtyDone },
        { label: 'Qty pending', value: qtyPending, accent: qtyPending > 0 ? 'text-amber-400' : '' },
        { label: 'Projects', value: projects.length },
    ];

    return (
        <Shell user={user} onAdd={() => router.push('/tasks')}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold sm:text-3xl">Dashboard</h1>
                    <p className="mt-1 text-neutral-500 capitalize">My tasks · {user?.role}</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn-ghost" onClick={() => setReportOpen(true)}>📧 Daily Report</button>
                    {isManager && (
                        <button className="btn-primary" onClick={() => router.push('/team')}>
                            Team Structure
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="mb-6 mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {stats.map((s) => (
                    <div key={s.label} className="card">
                        <p className="text-xs text-neutral-500">{s.label}</p>
                        <p className={`text-2xl font-semibold ${s.accent || ''}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Filter bar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                    className="input max-w-xs"
                    placeholder="Search tasks…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="all">All status</option>
                </select>

                {(q || status !== 'active') && (
                    <button className="btn-ghost" onClick={() => { setQ(''); setStatus('active'); }}>
                        Clear
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="card overflow-x-auto !p-0">
              {loading ? (
                <TableSkeleton rows={5} cols={8} />
              ) : rows.length === 0 ? (
                <EmptyState
                    icon="🎉"
                    title={status === 'active' ? "You're all caught up!" : 'No tasks match these filters.'}
                    hint={status === 'active' ? 'Nothing pending right now.' : undefined}
                />
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                    <thead>
                        <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-neutral-500">
                            <th className="px-4 py-3 font-medium">Done</th>
                            {th('title', 'Task')}
                            {th('project', 'Project')}
                            <th className="px-4 py-3 font-medium">Qty</th>
                            <th className="px-4 py-3 font-medium">Priority</th>
                            <th className="px-4 py-3 font-medium">Due</th>
                            <th className="px-4 py-3 font-medium">Subtasks</th>
                            {th('status', 'Status')}
                            <th className="px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((t) => (
                            <tr key={t._id} className="border-b border-line/60 last:border-0 hover:bg-panel2/40">
                                <td className="px-4 py-3">
                                    {t.trackProgress ? (
                                        <span className="text-neutral-600">—</span>
                                    ) : (
                                        <input type="checkbox" className="h-[18px] w-[18px] accent-neutral-900 dark:accent-white"
                                            checked={t.status === 'completed'} onChange={() => complete(t)} />
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={t.status === 'completed' ? 'text-neutral-500 line-through' : 'font-medium'}>
                                        {t.parentTask && <span className="mr-1 text-neutral-600">↳</span>}
                                        {t.title}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.project?.name || '—'}</td>

                                {/* Qty */}
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
                                    ) : <span className="text-neutral-600">—</span>}
                                </td>

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

                                {/* Subtasks */}
                                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                                    {t.subCount?.total ? `${t.subCount.done}/${t.subCount.total}` : '—'}
                                </td>

                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`rounded-full px-2.5 py-1 text-xs ${t.status === 'completed' ? 'bg-green-500/15 text-green-400' : 'bg-neutral-500/15 text-neutral-500'
                                            }`}>
                                            {t.status}
                                        </span>
                                        {t.status === 'completed' && (
                                            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">+{pointsFor(t)} pts</span>
                                        )}
                                    </div>
                                </td>

                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-2">
                                        {t.trackProgress && (
                                            <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => setProgressTask(t)}>Log</button>
                                        )}
                                        {!t.trackProgress && t.status !== 'completed' && (
                                            <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => complete(t)}>Complete</button>
                                        )}
                                        {t.project?._id && (
                                            <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => router.push(`/projects/${t.project._id}`)}>Open</button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              )}
            </div>

            <ProgressModal
                task={progressTask}
                open={!!progressTask}
                onClose={() => setProgressTask(null)}
                onChange={load}
            />
            <DailyReportModal open={reportOpen} onClose={() => setReportOpen(false)} />
        </Shell>
    );
}
