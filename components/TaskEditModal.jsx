'use client';
import { useEffect, useState } from 'react';
import Modal from './Modal';
import FileButton from './FileButton';
import { toast } from '@/lib/toast';
import { PRIORITY_META, DEPARTMENTS, departmentLabel } from '@/lib/taskDisplay';

const EMPTY = {
    title: '', description: '', assignedTo: [], department: '', priority: 'medium',
    dueDate: '', trackProgress: false, unit: '', target: '', attachments: [],
};

/** Full edit for one task — used from the project detail page's action boards. */
export default function TaskEditModal({ task, users, open, onClose, onChange, uploadFiles }) {
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!task) return;
        setForm({
            title: task.title || '',
            description: task.description || '',
            assignedTo: task.assignedTo?.map((u) => u._id) || [],
            department: task.department || '',
            priority: task.priority || 'medium',
            dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : '',
            trackProgress: !!task.trackProgress,
            unit: task.unit || '',
            target: task.target ?? '',
            attachments: task.attachments || [],
        });
    }, [task]);

    function toggleAssign(id) {
        setForm((f) => ({
            ...f,
            assignedTo: f.assignedTo.includes(id) ? f.assignedTo.filter((x) => x !== id) : [...f.assignedTo, id],
        }));
    }

    async function save() {
        if (!form.title.trim()) return toast.error('Title is required.');
        if (!form.department) return toast.error('Pick a department.');
        setSaving(true);
        try {
            const res = await fetch(`/api/tasks/${task._id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: form.title, description: form.description, assignedTo: form.assignedTo,
                    department: form.department, priority: form.priority, dueDate: form.dueDate || null,
                    trackProgress: form.trackProgress, unit: form.unit, target: form.target,
                    attachments: form.attachments,
                }),
            });
            if (!res.ok) return toast.error('Failed to update task.');
            toast.success('Task updated.');
            onChange?.();
            onClose();
        } finally {
            setSaving(false);
        }
    }

    if (!task) return null;

    return (
        <Modal open={open} onClose={onClose} title="Edit Task">
            <div className="mb-3.5">
                <label className="label">Title</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="mb-3.5">
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="mb-3.5 flex gap-3">
                <div className="flex-1">
                    <label className="label">Department</label>
                    <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                        <option value="" disabled>Select a department…</option>
                        {DEPARTMENTS.map((d) => <option key={d} value={d}>{departmentLabel(d)}</option>)}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="label">Priority</label>
                    <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                        {Object.entries(PRIORITY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                    </select>
                </div>
            </div>
            <div className="mb-3.5">
                <label className="label">Due date (optional)</label>
                <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div className="mb-3.5">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                    <input
                        type="checkbox" className="h-4 w-4 accent-neutral-900 dark:accent-white"
                        checked={form.trackProgress}
                        onChange={(e) => setForm({ ...form, trackProgress: e.target.checked })}
                    />
                    Track daily quantity (e.g. RxPad, videos)
                </label>
            </div>
            {form.trackProgress && (
                <div className="mb-3.5 flex gap-3">
                    <div className="flex-1">
                        <label className="label">Unit</label>
                        <input className="input" placeholder="RxPad" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                    </div>
                    <div className="flex-1">
                        <label className="label">Target (optional)</label>
                        <input className="input" type="number" placeholder="500" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
                    </div>
                </div>
            )}
            <div className="mb-3.5">
                <div className="mb-2 flex items-center justify-between">
                    <label className="label !mb-0">Attachments</label>
                    <FileButton
                        label="Attach files"
                        multiple
                        onFiles={async (files) => {
                            const uploaded = await uploadFiles(files);
                            if (uploaded.length) setForm((f) => ({ ...f, attachments: [...f.attachments, ...uploaded] }));
                        }}
                    />
                </div>
                {form.attachments.length > 0 && (
                    <ul className="space-y-1">
                        {form.attachments.map((a, i) => (
                            <li key={i} className="flex items-center justify-between gap-2 text-sm">
                                <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-neutral-700 hover:underline dark:text-neutral-300">{a.name}</a>
                                <button
                                    className="shrink-0 text-xs text-neutral-500 hover:text-red-400"
                                    onClick={() => setForm((f) => ({ ...f, attachments: f.attachments.filter((_, idx) => idx !== i) }))}
                                >✕</button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="mb-5">
                <label className="label">Assign To (multiple)</label>
                <div className="flex flex-wrap gap-2">
                    {users.map((u) => (
                        <button
                            key={u._id} type="button"
                            onClick={() => toggleAssign(u._id)}
                            className={`rounded-full border border-line px-3 py-1.5 text-sm transition-colors ${form.assignedTo.includes(u._id) ? 'bg-neutral-900 text-white dark:bg-white dark:text-black' : 'bg-panel2 text-neutral-900 dark:text-neutral-100'
                                }`}
                        >
                            {u.name}
                        </button>
                    ))}
                </div>
            </div>
            <button className="btn-primary w-full" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
            </button>
        </Modal>
    );
}
