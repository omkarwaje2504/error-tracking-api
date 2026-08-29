'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import { CardSkeleton } from '@/components/Skeleton';
import { toast } from '@/lib/toast';
import { confirmDialog, promptDialog } from '@/lib/confirm';
import { getSession } from '@/lib/session';

// How long a revealed password stays on screen before auto-hiding again.
const AUTO_HIDE_MS = 60_000;

const EMPTY_FORM = { service: '', name: '', username: '', password: '', notes: '' };

// Older entries (or plain typos) might not have `service` set — fall back
// to the account's own label so nothing vanishes from the list.
function groupKeyFor(c) {
    return (c.service || c.name || 'Other').trim();
}

export default function Credentials() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [creds, setCreds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [edit, setEdit] = useState(null);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    // { [credId]: { password, timer } } — kept only in memory, never persisted client-side.
    const [revealed, setRevealed] = useState({});

    useEffect(() => { load(); }, []);

    // Clear every pending auto-hide timer on unmount so nothing fires after
    // the page's gone.
    useEffect(() => () => {
        Object.values(revealed).forEach((r) => r.timer && clearTimeout(r.timer));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function load() {
        setLoading(true);
        const me = await getSession();
        if (!me) return router.push('/login');
        setUser(me);
        const res = await fetch('/api/credentials');
        setCreds(res.ok ? await res.json() : []);
        setLoading(false);
    }

    function openNew(service) { setEdit(null); setForm({ ...EMPTY_FORM, service: service || '' }); setOpen(true); }
    function openEdit(c) {
        setEdit(c._id);
        setForm({ service: c.service || '', name: c.name || '', username: c.username || '', password: '', notes: c.notes || '' });
        setOpen(true);
    }
    function closeModal() { setOpen(false); setEdit(null); setForm(EMPTY_FORM); }

    async function save() {
        if (!form.service.trim()) return toast.error('Service is required.');
        if (!edit && !form.password) return toast.error('Password is required.');
        setSaving(true);
        try {
            const url = edit ? `/api/credentials/${edit}` : '/api/credentials';
            const res = await fetch(url, {
                method: edit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) return toast.error(data.error || 'Failed to save.');
            toast.success(edit ? 'Credential updated.' : 'Credential added.');
            closeModal(); load();
        } finally {
            setSaving(false);
        }
    }

    async function remove(c) {
        const ok = await confirmDialog(`Delete this ${c.service || c.name} account? This can't be undone.`, { danger: true, confirmLabel: 'Delete' });
        if (!ok) return;
        const res = await fetch(`/api/credentials/${c._id}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return toast.error(data.error || 'Failed to delete.');
        toast.success('Credential deleted.');
        load();
    }

    function hide(id) {
        setRevealed((r) => {
            const next = { ...r };
            if (next[id]?.timer) clearTimeout(next[id].timer);
            delete next[id];
            return next;
        });
    }

    async function reveal(c) {
        const label = c.name ? `${c.service} — ${c.name}` : c.service;
        const pw = await promptDialog(`Enter your login password to reveal "${label}":`, {
            placeholder: 'Your password', confirmLabel: 'Reveal', required: true, inputType: 'password',
        });
        if (!pw) return;
        const res = await fetch(`/api/credentials/${c._id}/reveal`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw }),
        });
        const data = await res.json();
        if (!res.ok) return toast.error(data.error || 'Failed to reveal.');
        const timer = setTimeout(() => hide(c._id), AUTO_HIDE_MS);
        setRevealed((r) => ({ ...r, [c._id]: { password: data.password, timer } }));
        load(); // pick up the updated "last viewed by" stamp
    }

    async function copyPassword(pw) {
        try {
            await navigator.clipboard.writeText(pw);
            toast.success('Password copied.');
        } catch {
            toast.error('Could not copy — select and copy manually.');
        }
    }

    const services = useMemo(
        () => [...new Set(creds.map((c) => groupKeyFor(c)))].sort((a, b) => a.localeCompare(b)),
        [creds]
    );

    // Matching accounts are grouped by service, so searching "team2" still
    // shows the Adobe heading with just that one account under it, while
    // searching "adobe" shows every account under that service.
    const groups = useMemo(() => {
        const matches = creds.filter((c) => (
            !q
            || groupKeyFor(c).toLowerCase().includes(q.toLowerCase())
            || (c.name || '').toLowerCase().includes(q.toLowerCase())
            || (c.username || '').toLowerCase().includes(q.toLowerCase())
        ));
        const byKey = new Map();
        for (const c of matches) {
            const key = groupKeyFor(c);
            if (!byKey.has(key)) byKey.set(key, []);
            byKey.get(key).push(c);
        }
        return [...byKey.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [creds, q]);

    return (
        <Shell user={user} onAdd={() => openNew()}>
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold sm:text-3xl">Credentials</h1>
                    <p className="mt-0.5 text-sm text-neutral-500">Shared with the team — passwords stay hidden until you re-enter your login password.</p>
                </div>
                <button className="btn-primary" onClick={() => openNew()}>+ New</button>
            </div>

            <div className="mb-4">
                <input className="input max-w-xs" placeholder="Search service, label or username…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            {loading ? (
                <div className="space-y-2"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
            ) : groups.length === 0 ? (
                <div className="card">
                    <EmptyState
                        icon="🔐"
                        title={q ? 'Nothing matches.' : 'No credentials saved yet.'}
                        hint={q ? undefined : 'Add a login the whole team might need — it stays encrypted until someone re-authenticates to view it.'}
                        action={q ? undefined : '+ New Credential'}
                        onAction={() => openNew()}
                    />
                </div>
            ) : (
                <div className="space-y-2.5">
                    {groups.map(([service, accounts]) => (
                        <div key={service} className="card !p-3">
                            <div className="mb-1.5 flex items-center justify-between px-0.5">
                                <h2 className="text-sm font-semibold">
                                    {service} <span className="font-normal text-neutral-500">· {accounts.length}</span>
                                </h2>
                                <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => openNew(service)}>+ Add account</button>
                            </div>

                            <div className="space-y-1">
                                {accounts.map((c) => {
                                    const isOwner = c.createdBy === user?.id;
                                    const canManage = isOwner || user?.role === 'lead' || user?.role === 'head';
                                    const live = revealed[c._id];
                                    const info = `Added by ${c.createdByName}${c.lastAccessedByName ? ` · last viewed by ${c.lastAccessedByName} on ${new Date(c.lastAccessedAt).toLocaleString()}` : ''}`;
                                    return (
                                        <div key={c._id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-line px-2.5 py-1.5 text-sm">
                                            <span className="min-w-0 flex-1 truncate">
                                                <span className="font-medium">{c.name || c.username || 'Account'}</span>
                                                {c.name && c.username && <span className="text-neutral-500"> · {c.username}</span>}
                                                {c.notes && <span className="text-neutral-500"> · {c.notes}</span>}
                                            </span>
                                            <span className="shrink-0 cursor-help text-xs text-neutral-400" title={info}>ⓘ</span>
                                            {live ? (
                                                <>
                                                    <code className="shrink-0 rounded bg-panel2 px-2 py-1 text-xs">{live.password}</code>
                                                    <button className="btn-ghost shrink-0 !px-2 !py-1 !text-xs" onClick={() => copyPassword(live.password)}>Copy</button>
                                                    <button className="btn-ghost shrink-0 !px-2 !py-1 !text-xs" onClick={() => hide(c._id)}>🙈</button>
                                                </>
                                            ) : (
                                                <button className="btn-ghost shrink-0 !px-2 !py-1 !text-xs" onClick={() => reveal(c)}>👁️ Reveal</button>
                                            )}
                                            {canManage && (
                                                <>
                                                    <button className="btn-ghost shrink-0 !px-2 !py-1 !text-xs" onClick={() => openEdit(c)}>Edit</button>
                                                    <button className="shrink-0 px-0.5 text-xs text-neutral-500 hover:text-red-400" onClick={() => remove(c)}>✕</button>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal open={open} onClose={closeModal} title={edit ? 'Edit Credential' : 'New Credential'}>
                <div className="mb-3.5">
                    <label className="label">Service</label>
                    <input
                        className="input" autoFocus list="cred-services"
                        placeholder="e.g. Adobe, Canva, Server SSH"
                        value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}
                    />
                    <datalist id="cred-services">
                        {services.map((s) => <option key={s} value={s} />)}
                    </datalist>
                    <p className="mt-1 text-xs text-neutral-500">Accounts under the same service are grouped together — e.g. multiple Adobe logins.</p>
                </div>
                <div className="mb-3.5">
                    <label className="label">Account label (optional)</label>
                    <input className="input" placeholder="e.g. Design team, Personal" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="mb-3.5">
                    <label className="label">Username / Email</label>
                    <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div className="mb-3.5">
                    <label className="label">{edit ? 'New password (leave blank to keep current)' : 'Password'}</label>
                    <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <div className="mb-5">
                    <label className="label">Notes (optional)</label>
                    <textarea className="input" rows={3} placeholder="URL, extra context…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <button className="btn-primary w-full" onClick={save} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </Modal>
        </Shell>
    );
}
