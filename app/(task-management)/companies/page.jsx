'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';

export default function Companies() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [open, setOpen] = useState(false);
    const [edit, setEdit] = useState(null);
    const [form, setForm] = useState({ name: '', description: '' });

    useEffect(() => { load(); }, []);

    async function load() {
        const me = await fetch('/api/auth/me');
        if (!me.ok) return router.push('/login');
        setUser(await me.json());
        setCompanies(await (await fetch('/api/companies')).json());
    }

    function openNew() {
        setEdit(null); setForm({ name: '', description: '' }); setOpen(true);
    }

    function closeModal() {
        setOpen(false); setEdit(null); setForm({ name: '', description: '' });
    }

    async function save() {
        const url = edit ? `/api/companies/${edit}` : '/api/companies';
        await fetch(url, {
            method: edit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        closeModal(); load();
    }

    async function remove(id) {
        if (!confirm('Soft delete this company?')) return;
        await fetch(`/api/companies/${id}`, { method: 'DELETE' });
        load();
    }

    return (
        <Shell user={user} onAdd={openNew}>
            <div className="mb-7 flex items-center justify-between">
                <h1 className="text-2xl font-semibold sm:text-3xl">Companies</h1>
                <button className="btn-primary" onClick={openNew}>+ New</button>
            </div>

            <div className="card overflow-x-auto !p-0">
                <table className="w-full min-w-[560px] text-sm">
                    <thead>
                        <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-neutral-500">
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Description</th>
                            <th className="px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {companies.length === 0 && (
                            <tr><td colSpan={3} className="px-4 py-8 text-center text-neutral-500">No companies.</td></tr>
                        )}
                        {companies.map((c) => (
                            <tr key={c._id} className="border-b border-line/60 last:border-0 hover:bg-panel2/40">
                                <td className="px-4 py-3">
                                    <button
                                        className="font-medium text-neutral-100 hover:underline"
                                        onClick={() => router.push(`/brands?company=${c._id}`)}
                                    >
                                        {c.name}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-neutral-400">
                                    <span className="line-clamp-1 max-w-md">{c.description || '—'}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            className="btn-ghost !px-3 !py-1.5 !text-xs"
                                            onClick={() => { setEdit(c._id); setForm({ name: c.name, description: c.description || '' }); setOpen(true); }}
                                        >
                                            Edit
                                        </button>
                                        <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => remove(c._id)}>
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal open={open} onClose={closeModal} title={edit ? 'Edit Company' : 'New Company'}>
                <div className="mb-3.5">
                    <label className="label">Name</label>
                    <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="mb-5">
                    <label className="label">Description</label>
                    <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <button className="btn-primary w-full" onClick={save}>Save</button>
            </Modal>
        </Shell>
    );
}