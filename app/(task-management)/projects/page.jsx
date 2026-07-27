'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';

function ProjectsInner() {
    const router = useRouter();
    const params = useSearchParams();
    const brandFilter = params.get('brand');

    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [brands, setBrands] = useState([]);
    const [open, setOpen] = useState(false);
    const [edit, setEdit] = useState(null);
    const [form, setForm] = useState({ name: '', description: '', brand: '' });

    useEffect(() => { load(); }, [brandFilter]);

    async function load() {
        const me = await fetch('/api/auth/me');
        if (!me.ok) return router.push('/login');
        setUser(await me.json());
        const url = brandFilter ? `/api/projects?brand=${brandFilter}` : '/api/projects';
        setProjects(await (await fetch(url)).json());
        setBrands(await (await fetch('/api/brands')).json());
    }

    function openNew() {
        setEdit(null); setForm({ name: '', description: '', brand: brandFilter || '' }); setOpen(true);
    }

    function closeModal() {
        setOpen(false); setEdit(null);
        setForm({ name: '', description: '', brand: brandFilter || '' });
    }

    async function save() {
        const url = edit ? `/api/projects/${edit}` : '/api/projects';
        await fetch(url, {
            method: edit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        closeModal(); load();
    }

    async function remove(id) {
        if (!confirm('Soft delete this project?')) return;
        await fetch(`/api/projects/${id}`, { method: 'DELETE' });
        load();
    }

    return (
        <Shell user={user} onAdd={openNew}>
            <div className="mb-7 flex items-center justify-between">
                <h1 className="text-2xl font-semibold sm:text-3xl">Projects</h1>
                <button className="btn-primary" onClick={openNew}>+ New</button>
            </div>

            <div className="card overflow-x-auto !p-0">
                <table className="w-full min-w-[640px] text-sm">
                    <thead>
                        <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-neutral-500">
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Brand</th>
                            <th className="px-4 py-3 font-medium">Company</th>
                            <th className="px-4 py-3 font-medium">Description</th>
                            <th className="px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">No projects.</td></tr>
                        )}
                        {projects.map((p) => (
                            <tr key={p._id} className="border-b border-line/60 last:border-0 hover:bg-panel2/40">
                                <td className="px-4 py-3">
                                    <button
                                        className="font-medium text-neutral-100 hover:underline"
                                        onClick={() => router.push(`/tasks?project=${p._id}`)}
                                    >
                                        {p.name}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-neutral-400">{p.brand?.name || '—'}</td>
                                <td className="px-4 py-3 text-neutral-400">{p.brand?.company?.name || '—'}</td>
                                <td className="px-4 py-3 text-neutral-400">
                                    <span className="line-clamp-1 max-w-xs">{p.description || '—'}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            className="btn-ghost !px-3 !py-1.5 !text-xs"
                                            onClick={() => { setEdit(p._id); setForm({ name: p.name, description: p.description || '', brand: p.brand?._id || '' }); setOpen(true); }}
                                        >
                                            Edit
                                        </button>
                                        <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => remove(p._id)}>
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal open={open} onClose={closeModal} title={edit ? 'Edit Project' : 'New Project'}>
                <div className="mb-3.5">
                    <label className="label">Name</label>
                    <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="mb-3.5">
                    <label className="label">Brand</label>
                    <select className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}>
                        <option value="">None</option>
                        {brands.map((b) => (
                            <option key={b._id} value={b._id}>
                                {b.name}{b.company?.name ? ` · ${b.company.name}` : ''}
                            </option>
                        ))}
                    </select>
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

export default function Projects() {
    return <Suspense><ProjectsInner /></Suspense>;
}