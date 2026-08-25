'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import EmptyState from '@/components/EmptyState';
import { CardSkeleton } from '@/components/Skeleton';
import { toast } from '@/lib/toast';
import { getSession } from '@/lib/session';
import { buildReportText } from '@/lib/dailyReportFormat';

function today() { return new Date().toISOString().slice(0, 10); }

const TEAMS = ['graphic', 'video', 'frontend', 'backend', 'app'];

export default function TeamReports() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(today());
    const [team, setTeam] = useState('');
    const [q, setQ] = useState('');
    const [reports, setReports] = useState([]);
    const [expanded, setExpanded] = useState({});

    useEffect(() => { load(); }, []);
    useEffect(() => { if (user) load(false); }, [date, team]);

    async function load(checkAuth = true) {
        setLoading(true);
        if (checkAuth) {
            const me = await getSession();
            if (!me) return router.push('/login');
            if (me.role !== 'head' && me.role !== 'lead') return router.push('/dashboard');
            setUser(me);
        }
        const params = new URLSearchParams({ date });
        if (team) params.set('team', team);
        const res = await fetch(`/api/reports/team?${params}`);
        if (res.ok) {
            const d = await res.json();
            setReports(d.reports);
        }
        setLoading(false);
    }

    const isHead = user?.role === 'head';

    const filtered = useMemo(
        () => reports.filter((r) => !q || r.user.name.toLowerCase().includes(q.toLowerCase())),
        [reports, q]
    );

    function textFor(r) {
        return buildReportText(r.user.name, date, r.completedToday, r.pending);
    }

    async function copyOne(r) {
        try {
            await navigator.clipboard.writeText(textFor(r));
            toast.success(`Copied ${r.user.name}'s report.`);
        } catch {
            toast.error('Could not copy automatically.');
        }
    }

    async function copyAll() {
        const combined = filtered.map((r) => textFor(r)).join('\n\n' + '—'.repeat(24) + '\n\n');
        try {
            await navigator.clipboard.writeText(combined);
            toast.success(`Copied ${filtered.length} reports.`);
        } catch {
            toast.error('Could not copy automatically.');
        }
    }

    return (
        <Shell user={user} onAdd={() => router.push('/tasks')}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold sm:text-3xl">Daily Reports</h1>
                    <p className="mt-1 text-neutral-500">What the team got done, ready to paste anywhere.</p>
                </div>
                <button className="btn-primary" onClick={copyAll} disabled={filtered.length === 0}>
                    Copy all ({filtered.length})
                </button>
            </div>

            <div className="mb-6 mt-5 flex flex-wrap items-center gap-2">
                <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} max={today()} />
                <input className="input max-w-xs" placeholder="Search team member…" value={q} onChange={(e) => setQ(e.target.value)} />
                {isHead && (
                    <select className="input w-auto capitalize" value={team} onChange={(e) => setTeam(e.target.value)}>
                        <option value="">All departments</option>
                        {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                )}
                {date !== today() && (
                    <button className="btn-ghost" onClick={() => setDate(today())}>Today</button>
                )}
            </div>

            {loading ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <CardSkeleton /><CardSkeleton />
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState icon="📭" title="No team members to report on." />
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {filtered.map((r) => {
                        const isOpen = !!expanded[r.user._id];
                        return (
                            <div key={r.user._id} className="card !p-0">
                                <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3.5">
                                    <div>
                                        <p className="font-medium">{r.user.name}</p>
                                        <p className="text-xs capitalize text-neutral-500">{r.user.role} · {r.user.team}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-xs text-green-500">{r.completedToday.length} done</span>
                                        <span className="rounded-full bg-neutral-500/15 px-2.5 py-1 text-xs text-neutral-600 dark:text-neutral-300">{r.pending.length} pending</span>
                                    </div>
                                </div>

                                {isOpen && (
                                    <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                                        {textFor(r)}
                                    </pre>
                                )}

                                <div className="flex gap-2 border-t border-line p-3">
                                    <button
                                        className="btn-ghost flex-1 !py-1.5 !text-xs"
                                        onClick={() => setExpanded((e) => ({ ...e, [r.user._id]: !e[r.user._id] }))}
                                    >
                                        {isOpen ? 'Hide report' : 'View report'}
                                    </button>
                                    <button className="btn-ghost !py-1.5 !text-xs" onClick={() => copyOne(r)}>Copy</button>
                                    <button className="btn-ghost !py-1.5 !text-xs" onClick={() => router.push(`/tasks?assignee=${r.user._id}`)}>Tasks →</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Shell>
    );
}
