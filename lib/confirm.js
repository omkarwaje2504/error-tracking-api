'use client';

let handler = null;

export function registerConfirmHandler(fn) {
    handler = fn;
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
