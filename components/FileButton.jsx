'use client';
import { useRef, useState } from 'react';

/**
 * A styled stand-in for <input type="file"> — the native control can't be
 * restyled directly, so this hides it and drives it via a normal button.
 * Shows its own spinner/disabled state for as long as `onFiles` is
 * in-flight, so every upload button in the app gets a loading indicator
 * for free without each caller having to wire one up.
 */
export default function FileButton({ label = 'Choose file', multiple = false, accept, onFiles, className = '' }) {
    const ref = useRef(null);
    const [busy, setBusy] = useState(false);

    async function handleChange(e) {
        // Snapshot into a plain array *before* touching e.target.value —
        // input.files is a live FileList tied to the control's current
        // selection, so clearing value first (to allow re-picking the same
        // file next time) empties the very reference we just grabbed, and
        // every upload silently sees zero files.
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (!files.length) return;
        setBusy(true);
        try {
            await onFiles?.(files);
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <button
                type="button"
                className={`btn-file ${className}`}
                onClick={() => ref.current?.click()}
                disabled={busy}
            >
                {busy ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                )}
                {busy ? 'Uploading…' : label}
            </button>
            <input
                ref={ref}
                type="file"
                multiple={multiple}
                accept={accept}
                className="hidden"
                onChange={handleChange}
            />
        </>
    );
}
