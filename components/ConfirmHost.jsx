'use client';
import { useEffect, useState } from 'react';
import { registerConfirmHandler, registerPromptHandler } from '@/lib/confirm';

export default function ConfirmHost() {
    const [state, setState] = useState(null); // { message, resolve, danger, confirmLabel, cancelLabel }
    const [promptState, setPromptState] = useState(null); // { message, resolve, placeholder, confirmLabel, required }
    const [promptValue, setPromptValue] = useState('');

    useEffect(() => {
        registerConfirmHandler((message, opts) => new Promise((resolve) => {
            setState({ message, resolve, ...opts });
        }));
        registerPromptHandler((message, opts) => new Promise((resolve) => {
            setPromptValue('');
            setPromptState({ message, resolve, ...opts });
        }));
    }, []);

    function close(result) {
        state?.resolve(result);
        setState(null);
    }

    function closePrompt(value) {
        promptState?.resolve(value);
        setPromptState(null);
        setPromptValue('');
    }

    function submitPrompt() {
        const trimmed = promptValue.trim();
        if (promptState?.required && !trimmed) return;
        closePrompt(trimmed || null);
    }

    if (state) {
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

    if (promptState) {
        return (
            <div
                className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4"
                onClick={() => closePrompt(null)}
            >
                <div className="card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                    <p className="mb-3 text-sm">{promptState.message}</p>
                    {(promptState.inputType === 'password' || promptState.inputType === 'text') ? (
                        <input
                            type={promptState.inputType}
                            className="input mb-5"
                            placeholder={promptState.placeholder || ''}
                            value={promptValue}
                            onChange={(e) => setPromptValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') submitPrompt(); }}
                            autoFocus
                        />
                    ) : (
                        <textarea
                            className="input mb-5"
                            rows={3}
                            placeholder={promptState.placeholder || ''}
                            value={promptValue}
                            onChange={(e) => setPromptValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitPrompt(); }}
                            autoFocus
                        />
                    )}
                    <div className="flex justify-end gap-2">
                        <button className="btn-ghost" onClick={() => closePrompt(null)}>Cancel</button>
                        <button
                            className="btn-primary"
                            onClick={submitPrompt}
                            disabled={promptState.required && !promptValue.trim()}
                        >
                            {promptState.confirmLabel || 'Submit'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
