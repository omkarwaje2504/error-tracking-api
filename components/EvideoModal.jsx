'use client';
import { useEffect, useState } from 'react';
import Modal from './Modal';
import { toast } from '@/lib/toast';
import { confirmDialog } from '@/lib/confirm';

function uid() {
    return Math.random().toString(36).slice(2, 10);
}

const EMPTY_ROW = () => ({
    id: uid(), language: '',
    textSetting: '', textSettingDone: false,
    male: '', maleDone: false,
    female: '', femaleDone: false,
});

/** One assignee dropdown + a "done" checkbox that only makes sense once someone's assigned. */
function RoleCell({ userId, done, users, onAssign, onToggleDone }) {
    return (
        <div className="flex items-center gap-2">
            <select className="input !py-1.5" value={userId} onChange={(e) => onAssign(e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
            <label
                className={`flex shrink-0 items-center gap-1 text-xs ${userId ? 'cursor-pointer text-neutral-500' : 'cursor-not-allowed text-neutral-300 dark:text-neutral-700'}`}
                title={userId ? (done ? 'Done — uncheck to reopen' : 'Mark done') : 'Assign someone first'}
            >
                <input
                    type="checkbox"
                    className="h-4 w-4 accent-green-600 disabled:opacity-40"
                    checked={!!done}
                    disabled={!userId}
                    onChange={(e) => onToggleDone(e.target.checked)}
                />
                Done
            </label>
        </div>
    );
}

/**
 * EVideo language generation task — instead of a daily quantity log (like
 * RxPad/PVR), this tracks one row per language with who's assigned to each
 * of its three roles, and whether each of those three has finished their
 * part. Rows are edited freely and persisted as one array on the task.
 */
export default function EvideoModal({ task, users, open, onClose, onChange }) {
    const [rows, setRows] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open && task) setRows(task.evideoRows?.length ? task.evideoRows.map((r) => ({ ...r })) : []);
    }, [open, task]);

    function addRow() {
        setRows((r) => [...r, EMPTY_ROW()]);
    }

    function updateRow(id, patch) {
        setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    }

    // Clearing an assignee also clears its done flag — a completion mark
    // shouldn't survive past the person who earned it being unassigned.
    function assignRole(id, role, userId) {
        updateRow(id, { [role]: userId, ...(userId ? {} : { [`${role}Done`]: false }) });
    }

    async function removeRow(id) {
        const ok = await confirmDialog('Remove this language row?', { danger: true, confirmLabel: 'Remove' });
        if (!ok) return;
        setRows((r) => r.filter((row) => row.id !== id));
    }

    async function save() {
        setSaving(true);
        try {
            const res = await fetch(`/api/tasks/${task._id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ evideoRows: rows }),
            });
            if (!res.ok) return toast.error('Failed to save languages.');
            toast.success('Languages saved.');
            onChange?.();
            onClose();
        } finally {
            setSaving(false);
        }
    }

    if (!task) return null;
    const doneCount = rows.filter((r) => r.textSettingDone && r.maleDone && r.femaleDone).length;

    return (
        <Modal open={open} onClose={onClose} title={`Languages · ${task.title}`} size="full">
            <p className="mb-4 text-xs text-neutral-500">
                One row per language — assign who handles text setting and the male/female voice generation, and check each off as they finish their part.
                {rows.length > 0 && <span className="ml-1 text-neutral-700 dark:text-neutral-300">{doneCount} / {rows.length} languages fully done.</span>}
            </p>

            <div className="mb-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                    <thead>
                        <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-neutral-500">
                            <th className="py-2 pr-2 font-medium">Language</th>
                            <th className="py-2 px-2 font-medium">Text setting</th>
                            <th className="py-2 px-2 font-medium">Male</th>
                            <th className="py-2 px-2 font-medium">Female</th>
                            <th className="py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={5} className="py-4 text-center text-neutral-500">No languages yet — add the first row below.</td></tr>
                        )}
                        {rows.map((row) => (
                            <tr key={row.id} className="border-b border-line/60 last:border-0">
                                <td className="py-2 pr-2 align-top">
                                    <input
                                        className="input !py-1.5" placeholder="e.g. French"
                                        value={row.language}
                                        onChange={(e) => updateRow(row.id, { language: e.target.value })}
                                    />
                                </td>
                                <td className="py-2 px-2 align-top">
                                    <RoleCell
                                        userId={row.textSetting} done={row.textSettingDone} users={users}
                                        onAssign={(v) => assignRole(row.id, 'textSetting', v)}
                                        onToggleDone={(v) => updateRow(row.id, { textSettingDone: v })}
                                    />
                                </td>
                                <td className="py-2 px-2 align-top">
                                    <RoleCell
                                        userId={row.male} done={row.maleDone} users={users}
                                        onAssign={(v) => assignRole(row.id, 'male', v)}
                                        onToggleDone={(v) => updateRow(row.id, { maleDone: v })}
                                    />
                                </td>
                                <td className="py-2 px-2 align-top">
                                    <RoleCell
                                        userId={row.female} done={row.femaleDone} users={users}
                                        onAssign={(v) => assignRole(row.id, 'female', v)}
                                        onToggleDone={(v) => updateRow(row.id, { femaleDone: v })}
                                    />
                                </td>
                                <td className="py-2 pl-2 text-right align-top">
                                    <button className="text-xs text-neutral-500 hover:text-red-400" onClick={() => removeRow(row.id)}>✕</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button className="btn-ghost mb-4 w-full" onClick={addRow}>+ Add row</button>
            <button className="btn-primary w-full" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save languages'}
            </button>
        </Modal>
    );
}
