'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import Shell from '@/components/Shell';
import EmptyState from '@/components/EmptyState';
import { CardSkeleton } from '@/components/Skeleton';
import { isOverdue, pointsFor } from '@/lib/taskDisplay';
import { getSession } from '@/lib/session';
import { getReference } from '@/lib/referenceCache';
import { getTeamSetting, setTeamSetting } from '@/lib/teamSettings';
import { toast } from '@/lib/toast';
import { colorFor } from '@/lib/colors';

const TEAMS = ['graphic', 'video', 'frontend', 'backend', 'app'];
// Empty string stands for "no product type set" on the task's project —
// kept in the hidden-types list the same way the API's excludeProductTypes
// param expects it. Kept separate from the Tasks/Projects hidden-types
// setting since this page filters member stats, not a task list.
const NO_TYPE = '';

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
    const [productTypes, setProductTypes] = useState([]);
    const [productTypeFilter, setProductTypeFilter] = useState('');
    const [hiddenProductTypes, setHiddenProductTypes] = useState([]);
    const [showProductTypeFilter, setShowProductTypeFilter] = useState(true);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    useEffect(() => { load(); }, []);

    useEffect(() => {
        if (!settingsLoaded) return;
        (async () => {
            setLoading(true);
            const p = new URLSearchParams();
            if (productTypeFilter) p.set('productType', productTypeFilter);
            else if (hiddenProductTypes.length) p.set('excludeProductTypes', hiddenProductTypes.join(','));
            const qs = p.toString();
            setTasks(await (await fetch(`/api/tasks${qs ? `?${qs}` : ''}`)).json());
            setLoading(false);
        })();
    }, [productTypeFilter, hiddenProductTypes, settingsLoaded]);

    async function load() {
        setLoading(true);
        const u = await getSession();
        if (!u) return router.push('/login');
        if (u.role !== 'lead' && u.role !== 'head') return router.push('/dashboard');
        setUser(u);
        if (u.role === 'lead') setDept(u.team);

        setUsers(await getReference('users'));
        setProductTypes(await getReference('productTypes'));

        const [savedFilter, savedHidden, savedShow] = await Promise.all([
            getTeamSetting('teamStructureProductTypeFilter', ''),
            getTeamSetting('teamStructureHiddenProductTypes', []),
            getTeamSetting('teamStructureShowProductTypeFilter', true),
        ]);
        setProductTypeFilter(savedFilter || '');
        setHiddenProductTypes(savedHidden || []);
        setShowProductTypeFilter(savedShow !== false);
        setSettingsLoaded(true);
    }

    async function selectProductType(name) {
        setProductTypeFilter(name);
        const nextHidden = name ? hiddenProductTypes.filter((t) => t !== name) : hiddenProductTypes;
        if (nextHidden !== hiddenProductTypes) setHiddenProductTypes(nextHidden);
        const ok = await Promise.all([
            setTeamSetting('teamStructureProductTypeFilter', name),
            nextHidden !== hiddenProductTypes ? setTeamSetting('teamStructureHiddenProductTypes', nextHidden) : Promise.resolve(true),
        ]);
        if (ok.some((x) => !x)) toast.error('Failed to save.');
    }

    async function toggleProductType(name) {
        const next = hiddenProductTypes.includes(name) ? hiddenProductTypes.filter((t) => t !== name) : [...hiddenProductTypes, name];
        setHiddenProductTypes(next);
        if (!(await setTeamSetting('teamStructureHiddenProductTypes', next))) toast.error('Failed to save.');
    }

    async function clearTypeFilters() {
        setProductTypeFilter('');
        setHiddenProductTypes([]);
        const ok = await Promise.all([
            setTeamSetting('teamStructureProductTypeFilter', ''),
            setTeamSetting('teamStructureHiddenProductTypes', []),
        ]);
        if (ok.some((x) => !x)) toast.error('Failed to save.');
    }

    async function toggleProductTypeFilterVisibility() {
        const next = !showProductTypeFilter;
        setShowProductTypeFilter(next);
        const ok = await setTeamSetting('teamStructureShowProductTypeFilter', next);
        if (!ok) return toast.error('Failed to save.');
        // Hiding the filter also clears it, so it doesn't stay silently applied.
        if (!next && (productTypeFilter || hiddenProductTypes.length)) clearTypeFilters();
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

    const typeOptions = useMemo(
        () => [{ _id: '__no-type__', name: 'No type', key: NO_TYPE }, ...productTypes.map((t) => ({ ...t, key: t.name }))],
        [productTypes]
    );

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
                {showProductTypeFilter && (
                    <select className="input w-auto" value={productTypeFilter} onChange={(e) => selectProductType(e.target.value)}>
                        <option value="">All product types</option>
                        {productTypes.map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}
                    </select>
                )}
                <button
                    type="button"
                    className="rounded-lg p-2 text-neutral-500 hover:bg-panel2 hover:text-neutral-800 dark:hover:text-neutral-200"
                    title={showProductTypeFilter ? 'Hide product type filter' : 'Show product type filter'}
                    onClick={toggleProductTypeFilterVisibility}
                >
                    {showProductTypeFilter ? <FiEye size={16} /> : <FiEyeOff size={16} />}
                </button>
                {(q || (isHead && dept) || productTypeFilter || hiddenProductTypes.length > 0) && (
                    <button className="btn-ghost" onClick={() => { setQ(''); if (isHead) setDept(''); clearTypeFilters(); }}>Clear</button>
                )}
            </div>

            {showProductTypeFilter && typeOptions.length > 1 && (
                <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs font-medium uppercase tracking-wider text-neutral-500">Type</span>
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

            {loading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
            ) : members.length === 0 ? (
                <EmptyState icon="🧑‍🤝‍🧑" title={`No team members${dept ? ` in ${dept}` : ''}${q ? ' match your search' : ''}.`} />
            ) : (
                <>
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
