'use client';
import { useEffect, useState } from 'react';
import Modal from './Modal';
import { toast } from '@/lib/toast';
import { confirmDialog } from '@/lib/confirm';

// Bugs found against a task later on — same parentTask mechanism as
// SubtaskModal, but kind: 'bug' keeps them out of the subtask list/count.
export default function BugModal({ task, users, open, onClose, onChange }) {
    const [bugs, setBugs] = useState([]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [assignee, setAssignee] = useState('');
    const [editId, setEditId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editAssignee, setEditAssignee] = useState('');

    useEffect(() => {
        if (open && task) load();
        cancelEdit();
    }, [open, task]);

    async function load() {
        const res = await fetch(`/api/tasks?parent=${task._id}&kind=bug`);
        setBugs(await res.json());
    }

    async function add() {
        if (!title.trim()) return toast.error('Bug title is required.');
        const res = await fetch('/api/tasks', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title, description,
                project: task.project?._id || null,
                parentTask: task._id,
                assignedTo: assignee ? [assignee] : [],
                kind: 'bug',
            }),
        });
        if (!res.ok) return toast.error('Failed to add bug.');
        setTitle(''); setDescription(''); setAssignee('');
        await load(); onChange?.();
    }

    async function toggle(b) {
        await fetch(`/api/tasks/${b._id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: b.status === 'pending' ? 'completed' : 'pending' }),
        });
        await load(); onChange?.();
    }

    async function remove(id) {
        const ok = await confirmDialog('Delete this bug?', { danger: true, confirmLabel: 'Delete' });
        if (!ok) return;
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        toast.success('Bug deleted.');
        await load(); onChange?.();
    }

    function startEdit(b) {
        setEditId(b._id);
        setEditTitle(b.title);
        setEditDescription(b.description || '');
        setEditAssignee(b.assignedTo?.[0]?._id || '');
    }

    function cancelEdit() {
        setEditId(null);
        setEditTitle('');
        setEditDescription('');
        setEditAssignee('');
    }

    async function saveEdit() {
        if (!editTitle.trim()) return toast.error('Bug title is required.');
        const res = await fetch(`/api/tasks/${editId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: editTitle,
                description: editDescription,
                assignedTo: editAssignee ? [editAssignee] : [],
            }),
        });
        if (!res.ok) return toast.error('Failed to update bug.');
        toast.success('Bug updated.');
        cancelEdit();
        await load(); onChange?.();
    }

    if (!task) return null;
    const fixed = bugs.filter((b) => b.status === 'completed').length;

    return (
        <Modal open={open} onClose={onClose} title={`Bugs · ${task.title}`} resizable>
            <p className="mb-4 text-sm text-neutral-500">{fixed} / {bugs.length} fixed</p>

            {/* Add */}
            <div className="mb-4 rounded-xl border border-line p-3">
                <input
                    className="input mb-2.5"
                    placeholder="Bug title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && add()}
                />
                <textarea
                    className="input mb-2.5"
                    placeholder="What's wrong? (optional)"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
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
            <div>
                {bugs.length === 0 && <p className="py-4 text-center text-neutral-500">No bugs filed yet.</p>}
                {bugs.map((b) => (
                    editId === b._id ? (
                        <div key={b._id} className="rounded-xl border border-line p-3 my-1.5">
                            <input
                                className="input mb-2.5"
                                placeholder="Bug title"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                autoFocus
                            />
                            <textarea
                                className="input mb-2.5"
                                placeholder="What's wrong? (optional)"
                                rows={2}
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
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
                        <div key={b._id} className="flex items-start gap-3 border-b border-line/60 py-2.5 last:border-0">
                            <input
                                type="checkbox"
                                className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-neutral-900 dark:accent-white"
                                checked={b.status === 'completed'}
                                onChange={() => toggle(b)}
                                title={b.status === 'completed' ? 'Fixed — uncheck to reopen' : 'Mark fixed'}
                            />
                            <div className="min-w-0 flex-1">
                                <p className={`truncate text-sm ${b.status === 'completed' ? 'text-neutral-500 line-through' : ''}`}>
                                    {b.title}
                                </p>
                                {b.description && (
                                    <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-neutral-500">{b.description}</p>
                                )}
                                <p className="mt-0.5 truncate text-xs text-neutral-500">
                                    {b.assignedTo?.map((u) => u.name).join(', ') || 'Unassigned'}
                                </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${b.status === 'completed' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-500'}`}>
                                {b.status === 'completed' ? 'Fixed' : 'Open'}
                            </span>
                            <button className="btn-ghost shrink-0 !px-2.5 !py-1 !text-xs" onClick={() => startEdit(b)}>Edit</button>
                            <button className="shrink-0 text-xs text-neutral-500 hover:text-red-400" onClick={() => remove(b._id)}>✕</button>
                        </div>
                    )
                ))}
            </div>
        </Modal>
    );
}
