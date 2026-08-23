'use client';
import { useEffect, useState } from 'react';
import Modal from './Modal';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/taskDisplay';

function buildReportText(data) {
    if (!data) return '';
    const { user, date, completedToday, pending, progressToday } = data;
    const niceDate = new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const lines = [];
    lines.push(`Daily Update — ${user.name} — ${niceDate}`);
    lines.push('');

    lines.push(`✅ Completed today (${completedToday.length})`);
    if (completedToday.length === 0) {
        lines.push('- Nothing marked complete yet.');
    } else {
        completedToday.forEach((t) => lines.push(`- ${t.title}${t.project?.name ? ` (${t.project.name})` : ''}`));
    }
    lines.push('');

    if (progressToday.length > 0) {
        lines.push('📊 Quantity logged today');
        progressToday.forEach((p) => {
            const parts = [];
            if (p.added) parts.push(`+${p.added} added`);
            if (p.completed) parts.push(`${p.completed} completed`);
            if (p.declined) parts.push(`${p.declined} declined`);
            lines.push(`- ${p.title}${p.project ? ` (${p.project})` : ''} — ${parts.join(', ') || 'no change'}`);
        });
        lines.push('');
    }

    lines.push(`🔄 In progress (${pending.length})`);
    if (pending.length === 0) {
        lines.push('- Nothing else pending — all caught up.');
    } else {
        pending.forEach((t) => {
            const due = t.dueDate ? ` — due ${formatDate(t.dueDate)}` : '';
            lines.push(`- ${t.title}${t.project?.name ? ` (${t.project.name})` : ''}${due}`);
        });
    }
    lines.push('');
    lines.push('Thanks!');

    return lines.join('\n');
}

export default function DailyReportModal({ open, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');

    useEffect(() => { if (open) load(); }, [open]);

    async function load() {
        setLoading(true);
        const res = await fetch('/api/reports/daily');
        if (res.ok) {
            const d = await res.json();
            setData(d);
            setText(buildReportText(d));
        }
        setLoading(false);
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Copied — paste it straight into your email.');
        } catch {
            toast.error('Could not copy automatically — select the text and copy manually.');
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="📧 Daily Report">
            {loading ? (
                <p className="py-6 text-center text-sm text-neutral-500">Building your report…</p>
            ) : (
                <>
                    <p className="mb-3 text-xs text-neutral-500">
                        Ready to paste into an email. Edit anything below before copying.
                    </p>
                    <textarea
                        className="input mb-4 font-mono text-xs leading-relaxed"
                        rows={16}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <button className="btn-primary w-full" onClick={copy}>Copy to clipboard</button>
                </>
            )}
        </Modal>
    );
}
