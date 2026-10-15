'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import FileButton from '@/components/FileButton';
import { CardSkeleton } from '@/components/Skeleton';
import { toast } from '@/lib/toast';
import { confirmDialog } from '@/lib/confirm';
import { getSession } from '@/lib/session';
import { uploadFilesToR2 } from '@/lib/upload';
import { POST_STATUS_META, todayStr } from '@/lib/posts';

const EMPTY_FORM = {
    title: '', postDate: '', caption: '', status: 'pending', attachments: [],
};

// Filters/view survive opening and closing things (per browser tab), same as Projects.
const VIEW_KEY = 'posts:view';

function readView() {
    try { return JSON.parse(sessionStorage.getItem(VIEW_KEY)) || {}; } catch { return {}; }
}

function thisMonth() {
    return todayStr().slice(0, 7);
}

/** 'YYYY-MM' -> inclusive [first, last] YYYY-MM-DD bounds. */
function monthRange(month) {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return [`${month}-01`, `${month}-${String(last).padStart(2, '0')}`];
}

function dayLabel(dateStr) {
    const today = todayStr();
    const d = new Date(`${dateStr}T00:00:00`);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const pretty = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    if (dateStr === today) return `Today · ${pretty}`;
    if (dateStr === yStr) return `Yesterday · ${pretty}`;
    return pretty;
}

function fileKind(a) {
    const type = a.type || '';
    const ext = (a.name || a.url || '').split('.').pop().toLowerCase();
    if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(ext)) return 'image';
    if (type.startsWith('video/') || ['mp4', 'mov', 'webm', 'm4v'].includes(ext)) return 'video';
    return 'file';
}

function fileExt(a) {
    const ext = (a.name || '').split('.').pop();
    return ext && ext !== a.name ? ext.toUpperCase().slice(0, 4) : 'FILE';
}

/** Square preview for one attachment — image, muted video frame, or an extension badge. */
function Thumb({ a, className = 'h-14 w-14' }) {
    const kind = fileKind(a);
    return (
        <a
            href={a.url} target="_blank" rel="noreferrer" title={a.name}
            onClick={(e) => e.stopPropagation()}
            className={`relative block shrink-0 overflow-hidden rounded-lg border border-line bg-panel2 ${className}`}
        >
            {kind === 'image' && <img src={a.url} alt={a.name} loading="lazy" className="h-full w-full object-cover" />}
            {kind === 'video' && (
                <>
                    <video src={`${a.url}#t=0.5`} muted preload="metadata" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 grid place-items-center text-lg text-white drop-shadow">▶</span>
                </>
            )}
            {kind === 'file' && (
                <span className="grid h-full w-full place-items-center text-[10px] font-semibold text-neutral-500">{fileExt(a)}</span>
            )}
        </a>
    );
}

export default function Posts() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ready, setReady] = useState(false);

    // filters — month/status go to the server, search is local
    const [q, setQ] = useState('');
    const [month, setMonth] = useState(thisMonth());
    const [statusFilter, setStatusFilter] = useState('');
    const [view, setView] = useState('posts'); // 'posts' | 'assets'
    const [assetKind, setAssetKind] = useState(''); // '' | 'image' | 'video' | 'file'

    const [open, setOpen] = useState(false);
    const [edit, setEdit] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    useEffect(() => { init(); }, []);

    useEffect(() => {
        if (!ready) return;
        load();
    }, [ready, month, statusFilter]);

    useEffect(() => {
        if (!ready) return; // don't clobber the saved view with defaults
        try {
            sessionStorage.setItem(VIEW_KEY, JSON.stringify({ q, month, statusFilter, view, assetKind }));
        } catch { /* storage unavailable — view just won't persist */ }
    }, [ready, q, month, statusFilter, view, assetKind]);

    async function init() {
        const me = await getSession();
        if (!me) return router.push('/login');
        setUser(me);
        const v = readView();
        if (typeof v.q === 'string') setQ(v.q);
        if (typeof v.month === 'string') setMonth(v.month);
        if (v.statusFilter) setStatusFilter(v.statusFilter);
        if (v.view === 'assets') setView('assets');
        if (v.assetKind) setAssetKind(v.assetKind);
        setReady(true);
    }

    async function load() {
        setLoading(true);
        const p = new URLSearchParams();
        if (month) {
            const [from, to] = monthRange(month);
            p.set('from', from); p.set('to', to);
        }
        if (statusFilter) p.set('status', statusFilter);
        const res = await fetch(`/api/posts?${p}`);
        setPosts(res.ok ? await res.json() : []);
        setLoading(false);
    }

    function openNew(postDate) {
        setEdit(null);
        setForm({ ...EMPTY_FORM, postDate: postDate || todayStr() });
        setOpen(true);
    }

    function openEdit(p) {
        setEdit(p._id);
        setForm({
            title: p.title || '', postDate: p.postDate || todayStr(), caption: p.caption || '',
            status: p.status || 'pending', attachments: p.attachments || [],
        });
        setOpen(true);
    }

    function closeModal() { setOpen(false); setEdit(null); setForm(EMPTY_FORM); }

    async function attach(files) {
        const { uploaded, errors } = await uploadFilesToR2(files, 'posts');
        errors.forEach((e) => toast.error(`${e.name}: ${e.message}`));
        if (uploaded.length) setForm((f) => ({ ...f, attachments: [...f.attachments, ...uploaded] }));
    }

    async function save() {
        if (!form.title.trim()) return toast.error('Title is required.');
        setSaving(true);
        try {
            const res = await fetch(edit ? `/api/posts/${edit}` : '/api/posts', {
                method: edit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return toast.error(data.error || 'Failed to save post.');
            toast.success(edit ? 'Post updated.' : 'Post added.');
            closeModal(); load();
        } finally {
            setSaving(false);
        }
    }

    async function toggleStatus(e, p) {
        e.stopPropagation();
        const status = p.status === 'posted' ? 'pending' : 'posted';
        setPosts((list) => list.map((x) => (x._id === p._id ? { ...x, status } : x)));
        const res = await fetch(`/api/posts/${p._id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        if (!res.ok) { toast.error('Failed to update status.'); return load(); }
        if (statusFilter && statusFilter !== status) load();
    }

    async function remove(p) {
        const ok = await confirmDialog(`Delete post "${p.title}"?`, { danger: true, confirmLabel: 'Delete' });
        if (!ok) return;
        const res = await fetch(`/api/posts/${p._id}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return toast.error(data.error || 'Failed to delete.');
        toast.success('Post deleted.');
        closeModal(); load();
    }

    const rows = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return posts;
        return posts.filter((p) => [p.title, p.caption]
            .some((s) => s?.toLowerCase().includes(needle)));
    }, [posts, q]);

    const groups = useMemo(() => {
        const map = new Map();
        rows.forEach((p) => {
            if (!map.has(p.postDate)) map.set(p.postDate, []);
            map.get(p.postDate).push(p);
        });
        return [...map.entries()];
    }, [rows]);

    const assets = useMemo(
        () => rows.flatMap((p) => (p.attachments || []).map((a, i) => ({ ...a, post: p, id: `${p._id}-${i}` })))
            .filter((a) => !assetKind || fileKind(a) === assetKind),
        [rows, assetKind]
    );

    const postedCount = rows.filter((p) => p.status === 'posted').length;
    const fileCount = rows.reduce((n, p) => n + (p.attachments?.length || 0), 0);
    const hasFilters = q || statusFilter || month !== thisMonth();
    const isManager = user?.role === 'lead' || user?.role === 'head';
    const canDelete = (p) => isManager || String(p.createdBy) === String(user?.id);
    const editing = edit ? posts.find((p) => p._id === edit) : null;

    return (
        <Shell user={user} onAdd={() => openNew()}>
            <div className="mb-7 flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold sm:text-3xl">Posts</h1>
                    <p className="mt-1 text-sm text-neutral-500">Daily posts and their files — the company&apos;s asset library.</p>
                </div>
                <button className="btn-primary shrink-0" onClick={() => openNew()}>+ New post</button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <input className="input max-w-xs" placeholder="Search posts…" value={q} onChange={(e) => setQ(e.target.value)} />
                <input
                    type="month" className="input w-auto" value={month}
                    onChange={(e) => setMonth(e.target.value)} title="Month (clear for all time)"
                />
                <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All status</option>
                    <option value="pending">Pending</option>
                    <option value="posted">Posted</option>
                </select>
                {hasFilters && (
                    <button
                        className="btn-ghost"
                        onClick={() => { setQ(''); setMonth(thisMonth()); setStatusFilter(''); }}
                    >
                        Clear
                    </button>
                )}
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-xl border border-line p-0.5 text-sm">
                    {[['posts', 'Posts'], ['assets', 'Assets']].map(([k, label]) => (
                        <button
                            key={k} type="button" onClick={() => setView(k)}
                            className={`rounded-lg px-3 py-1.5 transition ${view === k ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent)]' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {!loading && (
                    <p className="text-xs text-neutral-500">
                        {rows.length} post{rows.length === 1 ? '' : 's'} · {postedCount} posted · {rows.length - postedCount} pending · {fileCount} file{fileCount === 1 ? '' : 's'}
                    </p>
                )}
            </div>

            {loading ? (
                <CardSkeleton />
            ) : view === 'posts' ? (
                groups.length === 0 ? (
                    <div className="card">
                        <EmptyState
                            icon="🗓️"
                            title={hasFilters ? 'No posts match these filters.' : 'No posts this month yet.'}
                            hint={hasFilters ? undefined : 'Add each day\'s post with its creative attached — it builds the asset library as you go.'}
                            action="+ New post"
                            onAction={() => openNew()}
                        />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groups.map(([date, list]) => (
                            <div key={date}>
                                <div className="mb-2 flex items-center justify-between">
                                    <h2 className="text-sm font-semibold">
                                        {dayLabel(date)}
                                        <span className="ml-2 font-normal text-neutral-500">{list.length}</span>
                                    </h2>
                                    <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => openNew(date)}>+ Add post</button>
                                </div>
                                <div className="space-y-2">
                                    {list.map((p) => (
                                        <PostRow
                                            key={p._id} p={p}
                                            onOpen={() => openEdit(p)}
                                            onToggle={(e) => toggleStatus(e, p)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                <>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                        {[['', 'All files'], ['image', 'Images'], ['video', 'Videos'], ['file', 'Other']].map(([k, label]) => (
                            <button
                                key={k} type="button" onClick={() => setAssetKind(k)}
                                className={`rounded-full border px-2.5 py-1 text-xs transition ${assetKind === k ? 'border-transparent bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-line text-neutral-500'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {assets.length === 0 ? (
                        <div className="card">
                            <EmptyState icon="🖼️" title="No files here yet." hint="Files attached to posts show up in this library." />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                            {assets.map((a) => (
                                <div key={a.id} className="card !p-2">
                                    <Thumb a={a} className="aspect-square w-full" />
                                    <p className="mt-2 truncate text-xs font-medium" title={a.name}>{a.name}</p>
                                    <button
                                        type="button" onClick={() => openEdit(a.post)}
                                        className="block w-full truncate text-left text-[11px] text-neutral-500 hover:text-[var(--accent)]"
                                        title={`${a.post.title} · ${a.post.postDate}`}
                                    >
                                        {a.post.postDate} · {a.post.title}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            <Modal open={open} onClose={closeModal} title={edit ? 'Edit Post' : 'New Post'}>
                <div className="mb-3.5">
                    <label className="label">Title</label>
                    <input
                        className="input" autoFocus placeholder="e.g. Diwali greeting, product launch reel"
                        value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                </div>
                <div className="mb-3.5">
                    <label className="label">Date</label>
                    <input type="date" className="input" value={form.postDate} onChange={(e) => setForm({ ...form, postDate: e.target.value })} />
                </div>
                <div className="mb-3.5">
                    <label className="label">Caption / notes</label>
                    <textarea
                        className="input min-h-[90px]" placeholder="Caption, hashtags, anything to remember"
                        value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })}
                    />
                </div>
                <div className="mb-3.5">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                            type="checkbox" checked={form.status === 'posted'}
                            onChange={(e) => setForm({ ...form, status: e.target.checked ? 'posted' : 'pending' })}
                        />
                        Posted
                    </label>
                </div>
                <div className="mb-5">
                    <div className="mb-2 flex items-center justify-between">
                        <label className="label !mb-0">Attachments</label>
                        <FileButton label="Attach files" multiple onFiles={attach} />
                    </div>
                    {form.attachments.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {form.attachments.map((a, i) => (
                                <div key={a.url} className="group relative">
                                    <Thumb a={a} className="h-20 w-20" />
                                    <button
                                        type="button" title="Remove"
                                        onClick={() => setForm((f) => ({ ...f, attachments: f.attachments.filter((_, idx) => idx !== i) }))}
                                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[10px] text-white opacity-90 hover:opacity-100"
                                    >
                                        ✕
                                    </button>
                                    <p className="mt-1 w-20 truncate text-[10px] text-neutral-500" title={a.name}>{a.name}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-neutral-500">Attach the creative — images, videos, PDFs, source files.</p>
                    )}
                </div>
                {editing && (
                    <p className="mb-3 text-xs text-neutral-500">
                        Added by {editing.createdByName}
                        {editing.postedByName && ` · posted by ${editing.postedByName}`}
                    </p>
                )}
                <div className="flex items-center justify-between gap-2">
                    <div>
                        {editing && canDelete(editing) && (
                            <button className="text-sm text-neutral-500 hover:text-red-400" onClick={() => remove(editing)}>Delete</button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button className="btn-ghost" onClick={closeModal}>Cancel</button>
                        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : edit ? 'Save' : 'Add post'}</button>
                    </div>
                </div>
            </Modal>
        </Shell>
    );
}

function PostRow({ p, onOpen, onToggle }) {
    const posted = p.status === 'posted';
    const files = p.attachments || [];
    const meta = POST_STATUS_META[p.status] || POST_STATUS_META.pending;
    return (
        <div
            onClick={onOpen}
            className="card flex cursor-pointer gap-3 !p-3 transition hover:bg-panel2/40"
        >
            <button
                type="button" onClick={onToggle}
                title={posted ? 'Mark as pending' : 'Mark as posted'}
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] transition ${posted ? 'border-green-500 bg-green-500 text-white' : 'border-neutral-400 text-transparent hover:border-green-500 hover:text-green-500'}`}
            >
                ✓
            </button>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`font-medium ${posted ? 'text-neutral-500' : ''}`}>{p.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${meta.className}`}>{meta.label}</span>
                </div>
                {p.caption && <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-neutral-500">{p.caption}</p>}
                {files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {files.slice(0, 6).map((a) => <Thumb key={a.url} a={a} />)}
                        {files.length > 6 && (
                            <span className="grid h-14 w-14 place-items-center rounded-lg border border-line text-xs text-neutral-500">+{files.length - 6}</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
