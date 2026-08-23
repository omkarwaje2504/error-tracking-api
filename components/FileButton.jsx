'use client';
import { useRef } from 'react';

/**
 * A styled stand-in for <input type="file"> — the native control can't be
 * restyled directly, so this hides it and drives it via a normal button.
 */
export default function FileButton({ label = 'Choose file', multiple = false, accept, onFiles, className = '' }) {
    const ref = useRef(null);

    return (
        <>
            <button
                type="button"
                className={`btn-file ${className}`}
                onClick={() => ref.current?.click()}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                {label}
            </button>
            <input
                ref={ref}
                type="file"
                multiple={multiple}
                accept={accept}
                className="hidden"
                onChange={(e) => {
                    onFiles?.(e.target.files);
                    e.target.value = '';
                }}
            />
        </>
    );
}
