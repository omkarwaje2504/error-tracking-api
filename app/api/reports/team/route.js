import { query, where } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { buildDailyReport } from '@/lib/reportBuilder';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'head' && session.role !== 'lead') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const url = new URL(req.url);
    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const teamFilter = url.searchParams.get('team');

    const w = where().add('NOT "deleted"').add(`"role" IS DISTINCT FROM 'head'`);
    if (session.role === 'lead') {
        w.add('"team" = $?', session.team);
    } else if (teamFilter) {
        w.add('"team" = $?', teamFilter);
    }

    const members = await query(`SELECT "_id", "name", "role", "team" FROM users ${w.sql} ORDER BY "name" ASC`, w.params);

    const reports = await Promise.all(
        members.map(async (m) => ({
            user: { _id: m._id, name: m.name, role: m.role, team: m.team },
            ...(await buildDailyReport(m._id, date)),
        }))
    );

    return NextResponse.json({ date, reports });
}
