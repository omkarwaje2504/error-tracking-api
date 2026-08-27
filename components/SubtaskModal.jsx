'use client';
import { useEffect, useState } from 'react';
import Modal from './Modal';
import { toast } from '@/lib/toast';
import { confirmDialog } from '@/lib/confirm';

export default function SubtaskModal({ task, users, open, onClose, onChange }) {
    const [subs, setSubs] = useState([]);
    const [title, setTitle] = useState('');
    const [assignee, setAssignee] = useState('');
    const [editId, setEditId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editAssignee, setEditAssignee] = useState('');

    useEffect(() => {
        if (open && task) load();
        cancelEdit();
    }, [open, task]);

    async function load() {
        const res = await fetch(`/api/tasks?parent=${task._id}`);
        setSubs(await res.json());
    }

    async function add() {
        if (!title.trim()) return toast.error('Subtask title is required.');
        const res = await fetch('/api/tasks', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                project: task.project?._id || null,
                parentTask: task._id,
                assignedTo: assignee ? [assignee] : [],
            }),
        });
        if (!res.ok) return toast.error('Failed to add subtask.');
        setTitle(''); setAssignee('');
        await load(); onChange?.();
    }

    async function toggle(s) {
        await fetch(`/api/tasks/${s._id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: s.status === 'pending' ? 'completed' : 'pending' }),
        });
        await load(); onChange?.();
    }

    async function remove(id) {
        const ok = await confirmDialog('Delete this subtask?', { danger: true, confirmLabel: 'Delete' });
        if (!ok) return;
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        toast.success('Subtask deleted.');
        await load(); onChange?.();
    }

    function startEdit(s) {
        setEditId(s._id);
        setEditTitle(s.title);
        setEditAssignee(s.assignedTo?.[0]?._id || '');
    }

    function cancelEdit() {
        setEditId(null);
        setEditTitle('');
        setEditAssignee('');
    }

    async function saveEdit() {
        if (!editTitle.trim()) return toast.error('Subtask title is required.');
        const res = await fetch(`/api/tasks/${editId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: editTitle,
                assignedTo: editAssignee ? [editAssignee] : [],
            }),
        });
        if (!res.ok) return toast.error('Failed to update subtask.');
        toast.success('Subtask updated.');
        cancelEdit();
        await load(); onChange?.();
    }

    if (!task) return null;
    const done = subs.filter((s) => s.status === 'completed').length;

    return (
        <Modal open={open} onClose={onClose} title={`Subtasks · ${task.title}`}>
            <p className="mb-4 text-sm text-neutral-500">{done} / {subs.length} completed</p>

            {/* Add */}
            <div className="mb-4 rounded-xl border border-line p-3">
                <input
                    className="input mb-2.5"
                    placeholder="Subtask title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && add()}
                />
                <div className="flex gap-2">
                    <select className="input flex-1" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                        <option value="">Unassigned</option>
                        {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                    </select>
                    <button className="btn-primary shrink-0" onClick={add}>Add</button>
                </div>
            </div>

            {/* List */}
            <div className="max-h-64 overflow-y-auto">
                {subs.length === 0 && <p className="py-4 text-center text-neutral-500">No subtasks yet.</p>}
                {subs.map((s) => (
                    editId === s._id ? (
                        <div key={s._id} className="rounded-xl border border-line p-3 my-1.5">
                            <input
                                className="input mb-2.5"
                                placeholder="Subtask title"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <select className="input flex-1" value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)}>
                                    <option value="">Unassigned</option>
                                    {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                                </select>
                                <button className="btn-primary shrink-0" onClick={saveEdit}>Save</button>
                                <button className="btn-ghost shrink-0" onClick={cancelEdit}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div key={s._id} className="flex items-center gap-3 border-b border-line/60 py-2.5 last:border-0">
                            <input
                                type="checkbox"
                                className="h-[18px] w-[18px] shrink-0 accent-neutral-900 dark:accent-white"
                                checked={s.status === 'completed'}
                                onChange={() => toggle(s)}
                            />
                            <div className="min-w-0 flex-1">
                                <p className={`truncate text-sm ${s.status === 'completed' ? 'text-neutral-500 line-through' : ''}`}>
                                    {s.title}
                                </p>
                                <p className="truncate text-xs text-neutral-500">
                                    {s.assignedTo?.map((u) => u.name).join(', ') || 'Unassigned'}
                                </p>
                            </div>
                            <button className="btn-ghost shrink-0 !px-2.5 !py-1 !text-xs" onClick={() => startEdit(s)}>Edit</button>
                            <button className="shrink-0 text-xs text-neutral-500 hover:text-red-400" onClick={() => remove(s._id)}>✕</button>
                        </div>
                    )
                ))}
            </div>
        </Modal>
    );
}