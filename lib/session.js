'use client';

const KEY = 'app_session_cache_v1';
const TTL_MS = 24 * 60 * 60 * 1000; // 1 day

export function setSession(user) {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(KEY, JSON.stringify({ user, cachedAt: Date.now() })); } catch { /* ignore */ }
}

export function clearSession() {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

function readCache() {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.user || Date.now() - parsed.cachedAt > TTL_MS) return null;
        return parsed.user;
    } catch {
        return null;
    }
}

/**
 * The signed-in user, served from a same-day local cache when possible so
 * every page navigation doesn't re-hit /api/auth/me. Falls back to the
 * server (and refreshes the cache) once the cache is missing or a day old,
 * or immediately when force is true (e.g. after a 401 from some other call).
 *
 * This only saves the redundant "who am I" round trip on the client — every
 * data endpoint still verifies the session token server-side on every
 * request, so nothing here weakens actual authorization.
 */
export async function getSession(force = false) {
    if (!force) {
        const cached = readCache();
        if (cached) return cached;
    }
    const res = await fetch('/api/auth/me');
    if (!res.ok) { clearSession(); return null; }
    const user = await res.json();
    setSession(user);
    return user;
}
