import { oid } from '@/lib/objectId';

/**
 * Append one entry to the org-wide activity feed. Best-effort: never throws,
 * so a logging failure can't take down the mutation that triggered it.
 */
export async function logActivity(db, { type, message, project = null, task = null, user }) {
    try {
        await db.collection('activity').insertOne({
            type,
            message,
            project: project ? oid(project) : null,
            task: task ? oid(task) : null,
            user: user ? oid(user) : null,
            createdAt: new Date(),
        });
    } catch (e) {
        console.error('logActivity failed', e);
    }
}
