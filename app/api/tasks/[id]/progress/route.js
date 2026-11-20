import { query, insertRow } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

// List all log entries for a task + running totals
export async function GET(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const logs = await query(
        `SELECT pr."_id", pr."date", pr."added", pr."completed", pr."declined", pr."j2k", pr."note", pr."createdAt",
                CASE WHEN u."_id" IS NULL THEN NULL ELSE json_build_object('name', u."name") END AS "user"
         FROM progress pr LEFT JOIN users u ON u."_id" = pr."user"
         WHERE pr."task" = $1 AND NOT pr."deleted"
         ORDER BY pr."date" DESC, pr."createdAt" DESC`,
        [id]
    );

    const totals = logs.reduce(
        (acc, l) => ({
            added: acc.added + (l.added || 0),
            completed: acc.completed + (l.completed || 0),
            declined: acc.declined + (l.declined || 0),
            j2k: acc.j2k + (l.j2k || 0),
        }),
        { added: 0, completed: 0, declined: 0, j2k: 0 }
    );

    return NextResponse.json({ logs, totals });
}

// Add a day's entry — added (new batch), completed (done), declined (rejected / sent back for rework)
export async function POST(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const { date, added, completed, declined, j2k, note } = await req.json();

    const doc = await insertRow('progress', {
        task: id,
        date: date || new Date().toISOString().slice(0, 10),
        added: Number(added) || 0,
        completed: Number(completed) || 0,
        declined: Number(declined) || 0,
        // Only meaningful for PVR-style tasks (task.trackJ2K) — J2K file
        // generation count for the day, alongside the usual add/done/decline.
        j2k: Number(j2k) || 0,
        note: note || '',
        user: session.id,
        deleted: false,
        createdAt: new Date(),
    });
    return NextResponse.json(doc);
}
