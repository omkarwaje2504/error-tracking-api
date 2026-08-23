'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { CardSkeleton } from '@/components/Skeleton';

const TEAM_GROUPS = [
    { key: 'graphic', label: 'Graphic', teams: ['graphic'] },
    { key: 'video', label: 'Video', teams: ['video'] },
    { key: 'it', label: 'IT', teams: ['frontend', 'backend', 'app'] },
];

const ACTIVITY_ICON = {
    'task.created': '＋',
    'task.completed': '✓',
    'task.reopened': '↺',
    'project.created': '📁',
    'project.status_changed': '⇄',
    'discussion.posted': '💬',
};

function daysUntil(dateStr) {
    if (!dateStr) return null;
    const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
    return Math.round(ms / 86400000);
}

function timeAgo(dateStr) {
    const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

export default function Overview() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        const me = await fetch('/api/auth/me');
        if (!me.ok) return router.push('/login');
        const u = await me.json();
        if (u.role !== 'head') return router.push('/dashboard');
        setUser(u);

        setUsers(await (await fetch('/api/users')).json());
        setProjects(await (await fetch('/api/projects')).json());
        setTasks(await (await fetch('/api/tasks')).json());
        const actRes = await fetch('/api/activity?limit=25');
        setActivity(actRes.ok ? await actRes.json() : []);
        setLoading(false);
    }

    const groups = useMemo(() => {
        return TEAM_GROUPS.map((g) => {
            const members = users.filter((u) => !u.deleted && g.teams.includes(u.team));
            const memberIds = new Set(members.map((m) => m._id));
            const lead = members.find((m) => m.role === 'lead');
            const groupTasks = tasks.filter((t) => t.assignedTo?.some((a) => memberIds.has(a._id)));
            const pending = groupTasks.filter((t) => t.status !== 'completed').length;
            const completed = groupTasks.filter((t) => t.status === 'completed').length;
            const overdue = groupTasks.filter((t) => t.status !== 'completed' && t.dueDate && daysUntil(t.dueDate) < 0).length;
            const activeProjects = projects.filter((p) => g.teams.includes(p.projectType) && p.status === 'active').length;
            return { ...g, members, lead, pending, completed, overdue, activeProjects };
        });
    }, [users, tasks, projects]);

    const atRiskProjects = useMemo(() => {
        return projects
            .filter((p) => p.status === 'active' && p.deadline && daysUntil(p.deadline) <= 3)
            .map((p) => ({ ...p, daysLeft: daysUntil(p.deadline) }))
            .sort((a, b) => a.daysLeft - b.daysLeft);
    }, [projects]);

    const stats = useMemo(() => {
        const activeProjects = projects.filter((p) => p.status === 'active').length;
        const pendingTasks = tasks.filter((t) => t.status !== 'completed').length;
        const overdueTasks = tasks.filter((t) => t.status !== 'completed' && t.dueDate && daysUntil(t.dueDate) < 0).length;
        const people = users.filter((u) => !u.deleted && u.role !== 'head').length;
        return [
            { label: 'Active projects', value: activeProjects },
            { label: 'Pending tasks', value: pendingTasks },
            { label: 'Overdue tasks', value: overdueTasks, accent: overdueTasks > 0 ? 'text-red-500' : '' },
            { label: 'Projects at risk', value: atRiskProjects.length, accent: atRiskProjects.length > 0 ? 'text-amber-500' : '' },
            { label: 'People', value: people },
        ];
    }, [projects, tasks, users, atRiskProjects]);

    if (loading || !user) {
        return (
            <Shell user={user}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
            </Shell>
        );
    }

    return (
        <Shell user={user}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold sm:text-3xl">Overview</h1>
                    <p className="mt-1 text-neutral-500">Graphic · Video · IT, all in one place.</p>
                </div>
                <button className="btn-ghost" onClick={() => router.push('/team')}>Team Structure →</button>
            </div>

            {/* Org stats */}
            <div className="mb-8 mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {stats.map((s) => (
                    <div key={s.label} className="card">
                        <p className="text-xs text-neutral-500">{s.label}</p>
                        <p className={`text-2xl font-semibold ${s.accent || ''}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Team group cards */}
            <h2 className="mb-3 text-lg font-semibold">Departments</h2>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {groups.map((g) => (
                    <button
                        key={g.key}
                        className="card !p-0 text-left transition-colors hover:bg-panel2/40"
                        onClick={() => router.push(`/team?dept=${g.teams[0]}`)}
                    >
                        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
                            <div>
                                <p className="font-medium">{g.label}</p>
                                <p className="text-xs text-neutral-500">
                                    {g.lead ? `Lead: ${g.lead.name}` : 'No lead assigned'} · {g.members.length} member{g.members.length === 1 ? '' : 's'}
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 px-4 py-3.5 text-center">
                            <div>
                                <p className="text-lg font-semibold">{g.activeProjects}</p>
                                <p className="text-[11px] text-neutral-500">active projects</p>
                            </div>
                            <div>
                                <p className="text-lg font-semibold">{g.pending}</p>
                                <p className="text-[11px] text-neutral-500">pending tasks</p>
                            </div>
                            <div>
                                <p className={`text-lg font-semibold ${g.overdue > 0 ? 'text-red-500' : ''}`}>{g.overdue}</p>
                                <p className="text-[11px] text-neutral-500">overdue</p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* At-risk projects */}
                <div>
                    <h2 className="mb-3 text-lg font-semibold">Needs attention</h2>
                    <div className="card !p-0">
                        {atRiskProjects.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-neutral-500">Nothing overdue or due soon. 🎉</p>
                        ) : (
                            <ul>
                                {atRiskProjects.map((p) => (
                                    <li key={p._id} className="flex items-center justify-between gap-2 border-b border-line/60 px-4 py-3 last:border-0">
                                        <button className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline" onClick={() => router.push(`/projects/${p._id}`)}>
                                            {p.name}
                                        </button>
                                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${p.daysLeft < 0 ? 'bg-red-500/15 text-red-500' : 'bg-amber-500/15 text-amber-500'}`}>
                                            {p.daysLeft < 0 ? `${Math.abs(p.daysLeft)}d overdue` : p.daysLeft === 0 ? 'due today' : `due in ${p.daysLeft}d`}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Recent activity */}
                <div>
                    <h2 className="mb-3 text-lg font-semibold">Recent activity</h2>
                    <div className="card !p-0">
                        {activity.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-neutral-500">Nothing yet.</p>
                        ) : (
                            <ul className="max-h-96 overflow-y-auto">
                                {activity.map((a) => (
                                    <li key={a._id} className="flex items-start gap-2.5 border-b border-line/60 px-4 py-3 last:border-0">
                                        <span className="mt-0.5 shrink-0 text-sm">{ACTIVITY_ICON[a.type] || '•'}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm">{a.message}</p>
                                            <p className="text-xs text-neutral-500">
                                                {a.project?.name ? `${a.project.name} · ` : ''}{timeAgo(a.createdAt)}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </Shell>
    );
}
