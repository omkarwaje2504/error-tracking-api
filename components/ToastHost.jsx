'use client';
import { useEffect, useState } from 'react';
import { subscribeToasts, dismissToast } from '@/lib/toast';

const ICONS = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
};

const STYLES = {
    success: 'border-green-500/30 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300',
    error: 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    info: 'border-line bg-panel text-fg',
};

export default function ToastHost() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => subscribeToasts(setToasts), []);

    if (!toasts.length) return null;

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    onClick={() => dismissToast(t.id)}
                    role="status"
                    className={`pointer-events-auto flex w-full max-w-sm cursor-pointer items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg animate-[toast-in_0.15s_ease-out] ${STYLES[t.type] || STYLES.info}`}
                >
                    <span className="mt-0.5 shrink-0 text-xs font-bold">{ICONS[t.type] || ICONS.info}</span>
                    <span className="min-w-0 flex-1 break-words">{t.message}</span>
                </div>
            ))}
        </div>
    );
}
