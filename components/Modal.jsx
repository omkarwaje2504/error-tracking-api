'use client';

export default function Modal({ open, onClose, title, children, resizable = false }) {
    if (!open) return null;
    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
            onClick={onClose}
        >
            <div
                className={`card relative ${resizable
                    ? 'resize overflow-auto min-w-[320px] min-h-[240px] max-w-[95vw] max-h-[90vh]'
                    : 'w-full max-w-md max-h-[90vh] overflow-y-auto'
                }`}
                style={resizable ? { width: '32rem', height: '30rem' } : undefined}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-panel2 hover:text-neutral-800 dark:hover:text-neutral-200"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
                <h3 className="mb-5 pr-8 text-lg font-semibold">{title}</h3>
                {children}
            </div>
        </div>
    );
}