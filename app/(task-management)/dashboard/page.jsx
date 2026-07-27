'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import ProgressModal from '@/components/ProgressModal';

const TEAMS = ['graphic', 'video', 'frontend', 'backend', 'app'];

export default function Dashboard() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [brands, setBrands] = useState([]);
    const [users, setUsers] = useState([]);

    // filters
    const [team, setTeam] = useState('');
    const [assignee, setAssignee] = useState('');
    const [status, setStatus] = useState('pending');
    const [q, setQ] = useState('');
    const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });

    // inline controls
    const [progressTask, setProgressTask] = useState(null);
    const [reassignId, setReassignId] = useState(null);

    useEffect(() => { load(); }, [team, assignee]);

    async function load() {
        const me = await fetch('/api/auth/me');
        if (!me.ok) return router.push('/login');
        const u = await me.json();
        setUser(u);

        const params = new URLSearchParams();
        if (team) params.set('team', team);
        if (assignee) params.set('assignee', assignee);
        const url = `/api/tasks${params.toString() ? `?${params}` : ''}`;

        setTasks(await (await fetch(url)).json());
        setProjects(await (await fetch('/api/projects')).json());
        setCompanies(await (await fetch('/api/companies')).json());
        setBrands(await (await fetch('/api/brands')).json());
        setUsers(await (await fetch('/api/users')).json());
    }

    const isManager = user?.role === 'lead' || user?.role === 'head';

    async function complete(t) {
        await fetch(`/api/tasks/${t._id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: t.status === 'completed' ? 'pending' : 'completed' }),
        });
        load();
    }

    async function reassign(t, userId) {
        await fetch(`/api/tasks/${t._id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignedTo: userId ? [userId] : [] }),
        });
        setReassignId(null);
        load();
    }

    // client-side status + search + sort (server already did team/assignee + role scope)
    const rows = useMemo(() => {
        let r = tasks.filter((t) => {
            if (status === 'pending' && t.status !== 'pending') return false;
            if (status === 'completed' && t.status !== 'completed') return false;
            if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
            return true;
        });
        const val = (t) => {
            switch (sort.key) {
                case 'title': return t.title?.toLowerCase() || '';
                case 'project': return t.project?.name?.toLowerCase() || '';
                case 'assignee': return t.assignedTo?.[0]?.name?.toLowerCase() || '';
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
                className="cursor-pointer select-none px-4 py-3 font-medium hover:text-neutral-300"
                onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}
            >
                {label}{active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
            </th>
        );
    }

    const pending = tasks.filter((t) => t.status === 'pending').length;
    const done = tasks.filter((t) => t.status === 'completed').length;
    const qtyDone = tasks.reduce((s, t) => s + (t.progress?.completed || 0), 0);
    const qtyPending = tasks.reduce((s, t) => s + ((t.progress?.added || 0) - (t.progress?.completed || 0)), 0);

    const stats = [
        { label: 'Pending', value: pending },
        { label: 'Completed', value: done, accent: 'text-green-500' },
        { label: 'Qty done', value: qtyDone },
        { label: 'Qty pending', value: qtyPending, accent: qtyPending > 0 ? 'text-amber-400' : '' },
        { label: 'Projects', value: projects.length },
        { label: 'Brands', value: brands.length },
    ];

    return (
        <Shell user={user} onAdd={() => router.push('/tasks')}>
            <h1 className="text-2xl font-semibold sm:text-3xl">Dashboard</h1>
            <p className="mb-6 mt-1 text-neutral-500 capitalize">{user?.role} view</p>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
                    <option value="all">All status</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                </select>

                {isManager && (
                    <>
                        <select className="input w-auto capitalize" value={team} onChange={(e) => { setTeam(e.target.value); setAssignee(''); }}>
                            <option value="">All departments</option>
                            {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select className="input w-auto" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                            <option value="">All people</option>
                            {users
                                .filter((u) => !team || u.team === team)
                                .map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                        </select>
                    </>
                )}

                {(team || assignee || q || status !== 'pending') && (
                    <button className="btn-ghost" onClick={() => { setTeam(''); setAssignee(''); setQ(''); setStatus('pending'); }}>
                        Clear
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="card overflow-x-auto !p-0">
                <table className="w-full min-w-[880px] text-sm">
                    <thead>
                        <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-neutral-500">
                            <th className="px-4 py-3 font-medium">Done</th>
                            {th('title', 'Task')}
                            {th('project', 'Project')}
                            {th('assignee', 'Assignee')}
                            {isManager && <th className="px-4 py-3 font-medium">Dept</th>}
                            {th('createdBy', 'Created by')}
                            <th className="px-4 py-3 font-medium">Qty</th>
                            <th className="px-4 py-3 font-medium">Subtasks</th>
                            {th('status', 'Status')}
                            <th className="px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={isManager ? 9 : 8} className="px-4 py-8 text-center text-neutral-500">No tasks.</td></tr>
                        )}
                        {rows.map((t) => (
                            <tr key={t._id} className="border-b border-line/60 last:border-0 hover:bg-panel2/40">
                                <td className="px-4 py-3">
                                    {t.trackProgress ? (
                                        <span className="text-neutral-600">—</span>
                                    ) : (
                                        <input type="checkbox" className="h-[18px] w-[18px] accent-white"
                                            checked={t.status === 'completed'} onChange={() => complete(t)} />
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={t.status === 'completed' ? 'text-neutral-500 line-through' : 'font-medium'}>
                                        {t.parentTask && <span className="mr-1 text-neutral-600">↳</span>}
                                        {t.title}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-neutral-400">{t.project?.name || '—'}</td>

                                {/* Inline reassign */}
                                <td className="px-4 py-3">
                                    {reassignId === t._id ? (
                                        <select
                                            autoFocus
                                            className="input !py-1.5 !text-xs"
                                            defaultValue={t.assignedTo?.[0]?._id || ''}
                                            onChange={(e) => reassign(t, e.target.value)}
                                            onBlur={() => setReassignId(null)}
                                        >
                                            <option value="">Unassigned</option>
                                            {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                                        </select>
                                    ) : (
                                        <button
                                            className="text-neutral-400 hover:text-neutral-100 hover:underline"
                                            onClick={() => setReassignId(t._id)}
                                            title="Click to reassign"
                                        >
                                            {t.assignedTo?.map((u) => u.name).join(', ') || 'Unassigned'}
                                        </button>
                                    )}
                                </td>

                                {isManager && (
                                    <td className="px-4 py-3 text-neutral-500 capitalize">
                                        {t.department || [...new Set(t.assignedTo?.map((u) => u.team).filter(Boolean))].join(', ') || '—'}
                                    </td>
                                )}
                                <td className="px-4 py-3 text-neutral-500">{t.createdBy?.name || '—'}</td>

                                {/* Qty */}
                                <td className="px-4 py-3">
                                    {t.trackProgress ? (
                                        <button
                                            className="rounded-full bg-neutral-500/15 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-500/25"
                                            onClick={() => setProgressTask(t)}
                                        >
                                            {t.progress?.completed || 0}{t.target ? ` / ${t.target}` : ''} {t.unit || ''}
                                        </button>
                                    ) : <span className="text-neutral-600">—</span>}
                                </td>

                                {/* Subtasks */}
                                <td className="px-4 py-3 text-neutral-400">
                                    {t.subCount?.total ? `${t.subCount.done}/${t.subCount.total}` : '—'}
                                </td>

                                <td className="px-4 py-3">
                                    <span className={`rounded-full px-2.5 py-1 text-xs ${t.status === 'completed' ? 'bg-green-500/15 text-green-400' : 'bg-neutral-500/15 text-neutral-400'
                                        }`}>
                                        {t.status}
                                    </span>
                                </td>

                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-2">
                                        {t.trackProgress && (
                                            <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => setProgressTask(t)}>Log</button>
                                        )}
                                        {!t.trackProgress && t.status !== 'completed' && (
                                            <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => complete(t)}>Complete</button>
                                        )}
                                        <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => router.push(`/tasks?project=${t.project?._id || ''}`)}>Open</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ProgressModal
                task={progressTask}
                open={!!progressTask}
                onClose={() => setProgressTask(null)}
                onChange={load}
            />
        </Shell>
    );
}