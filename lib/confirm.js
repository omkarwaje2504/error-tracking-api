'use client';

let handler = null;
let promptHandler = null;

export function registerConfirmHandler(fn) {
    handler = fn;
}

export function registerPromptHandler(fn) {
    promptHandler = fn;
}

/**
 * Promise-based confirm dialog. Falls back to window.confirm if the
 * <ConfirmHost/> hasn't mounted yet for some reason.
 * opts: { danger?: boolean, confirmLabel?: string, cancelLabel?: string }
 */
export function confirmDialog(message, opts = {}) {
    if (!handler) return Promise.resolve(window.confirm(message));
    return handler(message, opts);
}

/**
 * Promise-based single-line text prompt (e.g. "why are you sending this
 * back?"). Resolves to the trimmed text, or null if cancelled/empty.
 * opts: { placeholder?: string, confirmLabel?: string, required?: boolean }
 */
export function promptDialog(message, opts = {}) {
    if (!promptHandler) {
        const v = window.prompt(message);
        return Promise.resolve(v ? v.trim() : null);
    }
    return promptHandler(message, opts);
}
