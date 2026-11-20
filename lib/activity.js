import { insertRow } from '@/lib/db';

/**
 * Append one entry to the org-wide activity feed. Best-effort: never throws,
 * so a logging failure can't take down the mutation that triggered it.
 */
export async function logActivity({ type, message, project = null, task = null, user }) {
    try {
        await insertRow('activity', {
            type,
            message,
            project: project || null,
            task: task || null,
            user: user || null,
            createdAt: new Date(),
        });
    } catch (e) {
        console.error('logActivity failed', e);
    }
}
