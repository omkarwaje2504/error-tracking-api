'use client';

export default function EmptyState({ icon = '📭', title, hint, action, onAction }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
            <span className="text-3xl opacity-60">{icon}</span>
            <p className="font-medium text-neutral-700 dark:text-neutral-300">{title}</p>
            {hint && <p className="max-w-xs text-sm text-neutral-500">{hint}</p>}
            {action && (
                <button className="btn-primary mt-3 !px-4 !py-2" onClick={onAction}>
                    {action}
                </button>
            )}
        </div>
    );
}
