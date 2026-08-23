'use client';
import { useEffect, useState } from 'react';
import Modal from './Modal';
import { toast } from '@/lib/toast';
import { confirmDialog } from '@/lib/confirm';

export default function ProgressModal({ task, open, onClose, onChange }) {
    const [data, setData] = useState({ logs: [], totals: { added: 0, completed: 0, declined: 0 } });
    const [form, setForm] = useState({ date: today(), added: '', completed: '', declined: '', note: '' });

    useEffect(() => { if (open && task) load(); }, [open, task]);

    function today() { return new Date().toISOString().slice(0, 10); }

    async function load() {
        const res = await fetch(`/api/tasks/${task._id}/progress`);
        setData(await res.json());
    }

    async function add() {
        if (!form.added && !form.completed && !form.declined) {
            return toast.error('Enter an added, completed or declined quantity.');
        }
        const res = await fetch(`/api/tasks/${task._id}/progress`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        if (!res.ok) return toast.error('Failed to add entry.');
        setForm({ date: today(), added: '', completed: '', declined: '', note: '' });
        toast.success('Entry added.');
        await load();
        onChange?.();
    }

    async function removeLog(logId) {
        const ok = await confirmDialog('Delete this entry?', { danger: true, confirmLabel: 'Delete' });
        if (!ok) return;
        await fetch(`/api/tasks/${task._id}/progress/${logId}`, { method: 'DELETE' });
        toast.success('Entry deleted.');
        await load();
        onChange?.();
    }

    if (!task) return null;
    const { added, completed, declined } = data.totals;
    const pending = Math.max(0, added - completed - declined);
    const pct = task.target ? Math.min(100, Math.round((completed / task.target) * 100)) : null;
    const unit = task.unit || 'items';

    return (
        <Modal open={open} onClose={onClose} title={`Progress · ${task.title}`}>
            <p className="mb-4 text-xs text-neutral-500">
                Log each batch as it moves — <span className="text-neutral-700 dark:text-neutral-300">added</span> when it goes in,{' '}
                <span className="text-green-500">completed</span> when it's done, and{' '}
                <span className="text-red-500">declined</span> for anything rejected and sent back for rework.
            </p>

            {/* Summary */}
            <div className="mb-4 grid grid-cols-4 gap-2 text-center">
                <Stat label="Added" value={added} />
                <Stat label="Completed" value={completed} accent="text-green-500" />
                <Stat label="Declined" value={declined} accent={declined > 0 ? 'text-red-500' : ''} />
                <Stat label="In batch" value={pending} accent={pending > 0 ? 'text-amber-500' : ''} />
            </div>

            {task.target != null && (
                <div className="mb-4">
                    <div className="mb-1 flex justify-between text-xs text-neutral-500">
                        <span>{completed} / {task.target} {unit}</span>
                        <span>{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-panel2">
                        <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                </div>
            )}

            {/* Add entry */}
            <div className="mb-4 rounded-xl border border-line p-3">
                <div className="mb-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                        <label className="label">Date</label>
                        <input className="input" type="date" value={form.date}
                            onChange={(e) => setForm({ ...form, date: e.target.value })} />
                    </div>
                    <div>
                        <label className="label">Added</label>
                        <input className="input" type="number" min="0" value={form.added}
                            onChange={(e) => setForm({ ...form, added: e.target.value })} />
                    </div>
                    <div>
                        <label className="label">Done</label>
                        <input className="input" type="number" min="0" value={form.completed}
                            onChange={(e) => setForm({ ...form, completed: e.target.value })} />
                    </div>
                    <div>
                        <label className="label">Declined</label>
                        <input className="input" type="number" min="0" value={form.declined}
                            onChange={(e) => setForm({ ...form, declined: e.target.value })} />
                    </div>
                </div>
                <input className="input mb-2.5" placeholder="Note (optional)" value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })} />
                <button className="btn-primary w-full" onClick={add}>Add entry</button>
            </div>

            {/* Log */}
            <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-neutral-500">
                            <th className="py-2 font-medium">Date</th>
                            <th className="py-2 font-medium">+Add</th>
                            <th className="py-2 font-medium">Done</th>
                            <th className="py-2 font-medium">Declined</th>
                            <th className="py-2 font-medium">By</th>
                            <th className="py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.logs.length === 0 && (
                            <tr><td colSpan={6} className="py-4 text-center text-neutral-500">No entries yet.</td></tr>
                        )}
                        {data.logs.map((l) => (
                            <tr key={l._id} className="border-b border-line/60 last:border-0">
                                <td className="py-2 text-neutral-700 dark:text-neutral-300">{l.date}</td>
                                <td className="py-2 text-neutral-600 dark:text-neutral-400">{l.added || '—'}</td>
                                <td className="py-2 text-green-500">{l.completed || '—'}</td>
                                <td className="py-2 text-red-500">{l.declined || '—'}</td>
                                <td className="py-2 text-neutral-500">{l.user?.name || '—'}</td>
                                <td className="py-2 text-right">
                                    <button className="text-xs text-neutral-500 hover:text-red-400"
                                        onClick={() => removeLog(l._id)}>✕</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Modal>
    );
}

function Stat({ label, value, accent = '' }) {
    return (
        <div className="rounded-xl bg-panel2 py-2.5">
            <p className={`text-xl font-semibold ${accent}`}>{value}</p>
            <p className="text-xs text-neutral-500">{label}</p>
        </div>
    );
}
