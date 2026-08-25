'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Shell from '@/components/Shell';
import EmptyState from '@/components/EmptyState';
import { CardSkeleton } from '@/components/Skeleton';
import { isOverdue, pointsFor } from '@/lib/taskDisplay';
import { getSession } from '@/lib/session';
import { getReference } from '@/lib/referenceCache';

const TEAMS = ['graphic', 'video', 'frontend', 'backend', 'app'];
const MEDALS = ['🥇', '🥈', '🥉'];

function dayKey(d) { return new Date(d).toISOString().slice(0, 10); }

function computeStreak(days) {
    const cursor = new Date();
    if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (days.has(dayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
    return streak;
}

function memberStats(tasks) {
    const completed = tasks.filter((t) => t.status === 'completed' && t.completedAt);
    const today = dayKey(new Date());
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yesterday = dayKey(yest);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const days = new Set(completed.map((t) => dayKey(t.completedAt)));
    return {
        points: completed.reduce((s, t) => s + pointsFor(t), 0),
        completedCount: completed.length,
        todayCount: completed.filter((t) => dayKey(t.completedAt) === today).length,
        yesterdayCount: completed.filter((t) => dayKey(t.completedAt) === yesterday).length,
        monthCount: completed.filter((t) => new Date(t.completedAt) >= monthStart).length,
        streak: computeStreak(days),
    };
}

function motivationalLine(rank, stats) {
    if (stats.streak >= 5) return `🔥 ${stats.streak}-day streak!`;
    if (rank === 0 && stats.points > 0) return '👑 Leading the pack';
    if (stats.todayCount >= 3) return '⚡ On fire today';
    if (stats.completedCount === 0) return '🌱 Getting started';
    if (stats.streak >= 2) return `✨ ${stats.streak} days running`;
    return '💪 Keep going';
}

function TeamStructureInner() {
    const router = useRouter();
    const params = useSearchParams();
    const [user, setUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dept, setDept] = useState(params.get('dept') || '');
    const [q, setQ] = useState('');
    const [showCompletedFor, setShowCompletedFor] = useState({});

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        const u = await getSession();
        if (!u) return router.push('/login');
        if (u.role !== 'lead' && u.role !== 'head') return router.push('/dashboard');
        setUser(u);
        if (u.role === 'lead') setDept(u.team);

        setUsers(await getReference('users'));
        setTasks(await (await fetch('/api/tasks')).json());
        setLoading(false);
    }

    const isHead = user?.role === 'head';

    const members = useMemo(() => {
        return users
            .filter((u) => !u.deleted)
            .filter((u) => u.role !== 'head')
            .filter((u) => (isHead ? true : u.team === user?.team))
            .filter((u) => !dept || u.team === dept)
            .filter((u) => !q || u.name?.toLowerCase().includes(q.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [users, dept, q, isHead, user]);

    const tasksByUser = useMemo(() => {
        const map = {};
        for (const t of tasks) {
            for (const a of t.assignedTo || []) {
                if (!map[a._id]) map[a._id] = [];
                map[a._id].push(t);
            }
        }
        return map;
    }, [tasks]);

    const leaderboard = useMemo(() => {
        return members
            .map((m) => ({ user: m, stats: memberStats(tasksByUser[m._id] || []) }))
            .sort((a, b) => b.stats.points - a.stats.points);
    }, [members, tasksByUser]);

    const chartData = useMemo(() => {
        const memberIds = new Set(members.map((m) => m._id));
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            days.push({ key: dayKey(d), label: d.toLocaleDateString(undefined, { weekday: 'short' }) });
        }
        const counts = Object.fromEntries(days.map((d) => [d.key, 0]));
        for (const t of tasks) {
            if (t.status !== 'completed' || !t.completedAt) continue;
            if (!t.assignedTo?.some((a) => memberIds.has(a._id))) continue;
            const key = dayKey(t.completedAt);
            if (key in counts) counts[key]++;
        }
        return days.map((d) => ({ name: d.label, Completed: counts[d.key] }));
    }, [tasks, members]);

    return (
        <Shell user={user} onAdd={() => router.push('/tasks')}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold sm:text-3xl">Team Structure</h1>
                    <p className="mt-1 text-neutral-500">Who's working on what — and who's crushing it.</p>
                </div>
                <button className="btn-ghost" onClick={() => router.push(isHead ? '/overview' : '/dashboard')}>
                    ← {isHead ? 'Overview' : 'Dashboard'}
                </button>
            </div>

            <div className="mb-6 mt-5 flex flex-wrap items-center gap-2">
                <input
                    className="input max-w-xs"
                    placeholder="Search team member…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                {isHead && (
                    <select className="input w-auto capitalize" value={dept} onChange={(e) => setDept(e.target.value)}>
                        <option value="">All departments</option>
                        {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                )}
                {(q || (isHead && dept)) && (
                    <button className="btn-ghost" onClick={() => { setQ(''); if (isHead) setDept(''); }}>Clear</button>
                )}
            </div>

            {loading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
            ) : members.length === 0 ? (
                <EmptyState icon="🧑‍🤝‍🧑" title={`No team members${dept ? ` in ${dept}` : ''}${q ? ' match your search' : ''}.`} />
            ) : (
                <>
                    {/* Performance overview */}
                    <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-5">
                        <div className="card lg:col-span-2">
                            <p className="mb-3 font-semibold">🏆 Leaderboard</p>
                            <div className="space-y-1.5">
                                {leaderboard.slice(0, 8).map((row, i) => (
                                    <div key={row.user._id} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-panel2/60">
                                        <span className="w-6 shrink-0 text-center text-sm">{MEDALS[i] || i + 1}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">{row.user.name}</p>
                                            <p className="truncate text-xs text-neutral-500">{motivationalLine(i, row.stats)}</p>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
                                            {row.stats.points} pts
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="card lg:col-span-3">
                            <p className="mb-3 font-semibold">📈 Completed this week</p>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b8b96' }} axisLine={false} tickLine={false} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#8b8b96' }} axisLine={false} tickLine={false} width={24} />
                                        <Tooltip
                                            contentStyle={{ background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: 10, fontSize: 12 }}
                                        />
                                        <Bar dataKey="Completed" fill="#818cf8" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Member cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {leaderboard.map(({ user: m, stats }) => {
                            const list = tasksByUser[m._id] || [];
                            const pending = list.filter((t) => t.status !== 'completed');
                            const completed = list.filter((t) => t.status === 'completed');
                            const overdue = pending.filter(isOverdue).length;
                            const showCompleted = !!showCompletedFor[m._id];
                            return (
                                <div key={m._id} className="card flex flex-col !p-0">
                                    <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
                                        <div>
                                            <p className="font-medium">{m.name}</p>
                                            <p className="text-xs capitalize text-neutral-500">{m.role} · {m.team}</p>
                                        </div>
                                        <div className="flex flex-wrap justify-end gap-1.5 text-xs">
                                            <span className="rounded-full bg-neutral-500/15 px-2 py-1 text-neutral-600 dark:text-neutral-300">{pending.length} active</span>
                                            {overdue > 0 && (
                                                <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-500">{overdue} overdue</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 px-4 py-3 text-center text-xs">
                                        <div><p className="text-lg font-semibold">{stats.todayCount}</p><p className="text-neutral-500">today</p></div>
                                        <div><p className="text-lg font-semibold">{stats.yesterdayCount}</p><p className="text-neutral-500">yesterday</p></div>
                                        <div><p className="text-lg font-semibold">{stats.monthCount}</p><p className="text-neutral-500">this month</p></div>
                                    </div>

                                    {/* Active tasks */}
                                    <div className="max-h-56 overflow-y-auto p-3 pt-0">
                                        {pending.length === 0 && (
                                            <p className="py-3 text-center text-sm text-neutral-500">Nothing active. 🎉</p>
                                        )}
                                        {pending.map((t) => (
                                            <div key={t._id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-panel2/60">
                                                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                                                {isOverdue(t) ? (
                                                    <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-500">overdue</span>
                                                ) : (
                                                    <span className="shrink-0 rounded-full bg-neutral-500/15 px-2 py-0.5 text-[11px] text-neutral-500">pending</span>
                                                )}
                                            </div>
                                        ))}

                                        {completed.length > 0 && (
                                            <>
                                                <button
                                                    className="mt-1 w-full text-left text-xs text-neutral-500 hover:underline"
                                                    onClick={() => setShowCompletedFor((s) => ({ ...s, [m._id]: !s[m._id] }))}
                                                >
                                                    {showCompleted ? 'Hide' : 'Show'} {completed.length} completed
                                                </button>
                                                {showCompleted && completed.map((t) => (
                                                    <div key={t._id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-panel2/60">
                                                        <span className="min-w-0 flex-1 truncate text-neutral-500 line-through">{t.title}</span>
                                                        <span className="shrink-0 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] text-green-500">done</span>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>

                                    <div className="border-t border-line px-3 py-2.5">
                                        <button
                                            className="btn-ghost w-full !py-1.5 !text-xs"
                                            onClick={() => router.push(`/tasks?assignee=${m._id}`)}
                                        >
                                            View all tasks
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </Shell>
    );
}

export default function TeamStructure() {
    return <Suspense><TeamStructureInner /></Suspense>;
}
