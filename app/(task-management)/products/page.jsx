'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import { CardSkeleton } from '@/components/Skeleton';
import { toast } from '@/lib/toast';
import { confirmDialog } from '@/lib/confirm';
import { colorFor } from '@/lib/colors';

export default function ProductTypes() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [edit, setEdit] = useState(null);
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        const me = await fetch('/api/auth/me');
        if (!me.ok) return router.push('/login');
        setUser(await me.json());
        setTypes(await (await fetch('/api/product-types')).json());
        setLoading(false);
    }

    function openNew() { setEdit(null); setName(''); setOpen(true); }
    function openEdit(t) { setEdit(t._id); setName(t.name); setOpen(true); }
    function closeModal() { setOpen(false); setEdit(null); setName(''); }

    async function save() {
        if (!name.trim()) return toast.error('Name is required.');
        setSaving(true);
        try {
            const url = edit ? `/api/product-types/${edit}` : '/api/product-types';
            const res = await fetch(url, {
                method: edit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const data = await res.json();
            if (!res.ok) return toast.error(data.error || 'Failed to save.');
            toast.success(edit ? 'Product type updated.' : 'Product type added.');
            closeModal(); load();
        } finally {
            setSaving(false);
        }
    }

    async function remove(t) {
        const ok = await confirmDialog(`Delete "${t.name}"?`, { danger: true, confirmLabel: 'Delete' });
        if (!ok) return;
        const res = await fetch(`/api/product-types/${t._id}`, { method: 'DELETE' });
        if (!res.ok) return toast.error('Failed to delete.');
        toast.success('Product type deleted.');
        load();
    }

    const rows = useMemo(
        () => types.filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase())),
        [types, q]
    );

    return (
        <Shell user={user} onAdd={openNew}>
            <div className="mb-7 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold sm:text-3xl">Product Types</h1>
                    <p className="mt-1 text-neutral-500">What kind of work a project is — E-Video, Poster, App, and so on.</p>
                </div>
                <button className="btn-primary" onClick={openNew}>+ New</button>
            </div>

            <div className="mb-6">
                <input className="input max-w-xs" placeholder="Search product types…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
            ) : rows.length === 0 ? (
                <div className="card">
                    <EmptyState
                        icon="🏷️"
                        title={q ? 'Nothing matches.' : 'No product types yet.'}
                        hint={q ? undefined : 'You can also just type a new one straight into a project\'s Product type field.'}
                        action={q ? undefined : '+ New Product Type'}
                        onAction={openNew}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {rows.map((t) => {
                        const c = colorFor(t.name);
                        return (
                            <div key={t._id} className={`card group relative overflow-hidden !p-4 ${c.bg}`}>
                                <div className={`absolute inset-x-0 top-0 h-1 ${c.bar}`} />
                                <p className={`truncate font-semibold ${c.text}`}>{t.name}</p>
                                <div className="mt-2.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button className="rounded-md bg-panel/70 px-2 py-1 text-xs hover:underline" onClick={() => openEdit(t)}>Rename</button>
                                    <button className="rounded-md bg-panel/70 px-2 py-1 text-xs text-red-500 hover:underline" onClick={() => remove(t)}>Delete</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Modal open={open} onClose={closeModal} title={edit ? 'Rename Product Type' : 'New Product Type'}>
                <div className="mb-5">
                    <label className="label">Name</label>
                    <input
                        className="input" autoFocus value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && save()}
                    />
                </div>
                <button className="btn-primary w-full" onClick={save} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </Modal>
        </Shell>
    );
}
