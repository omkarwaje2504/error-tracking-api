'use client';

/**
 * Client helpers for the shared /api/settings store. Which value a given
 * user actually gets back (the team-wide one, or their own private one) is
 * resolved server-side by role — see app/api/settings/route.js.
 */
export async function getTeamSetting(name, fallback = null) {
    try {
        const res = await fetch(`/api/settings?name=${encodeURIComponent(name)}`);
        if (!res.ok) return fallback;
        const data = await res.json();
        return data.value ?? fallback;
    } catch {
        return fallback;
    }
}

export async function setTeamSetting(name, value) {
    const res = await fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value }),
    });
    return res.ok;
}
