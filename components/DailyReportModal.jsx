'use client';
import { useEffect, useState } from 'react';
import Modal from './Modal';
import { toast } from '@/lib/toast';
import { buildReportText } from '@/lib/dailyReportFormat';

export default function DailyReportModal({ open, onClose }) {
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');

    useEffect(() => { if (open) load(); }, [open]);

    async function load() {
        setLoading(true);
        const res = await fetch('/api/reports/daily');
        if (res.ok) {
            const d = await res.json();
            setText(buildReportText(d.user.name, d.date, d.completedToday, d.pending));
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
