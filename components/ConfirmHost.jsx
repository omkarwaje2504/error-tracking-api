'use client';
import { useEffect, useState } from 'react';
import { registerConfirmHandler } from '@/lib/confirm';

export default function ConfirmHost() {
    const [state, setState] = useState(null); // { message, resolve, danger, confirmLabel, cancelLabel }

    useEffect(() => {
        registerConfirmHandler((message, opts) => new Promise((resolve) => {
            setState({ message, resolve, ...opts });
        }));
    }, []);

    function close(result) {
        state?.resolve(result);
        setState(null);
    }

    if (!state) return null;

    return (
        <div
            className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4"
            onClick={() => close(false)}
        >
            <div className="card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                <p className="mb-5 text-sm">{state.message}</p>
                <div className="flex justify-end gap-2">
                    <button className="btn-ghost" onClick={() => close(false)}>
                        {state.cancelLabel || 'Cancel'}
                    </button>
                    <button
                        className="btn-primary"
                        style={state.danger ? { background: '#dc2626', color: '#fff' } : undefined}
                        onClick={() => close(true)}
                        autoFocus
                    >
                        {state.confirmLabel || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}
