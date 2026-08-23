'use client';

let idCounter = 0;
let toasts = [];
let listeners = [];

function emit() {
    listeners.forEach((fn) => fn(toasts));
}

export function subscribeToasts(fn) {
    listeners.push(fn);
    fn(toasts);
    return () => { listeners = listeners.filter((l) => l !== fn); };
}

export function dismissToast(id) {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
}

function push(type, message, duration) {
    const id = ++idCounter;
    toasts = [...toasts, { id, type, message }];
    emit();
    setTimeout(() => dismissToast(id), duration || (type === 'error' ? 5000 : 3200));
    return id;
}

export const toast = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message),
};
