import { connectDB } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { buildDailyReport } from '@/lib/reportBuilder';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'head' && session.role !== 'lead') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const db = await connectDB();
    const url = new URL(req.url);
    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const teamFilter = url.searchParams.get('team');

    const userMatch = { deleted: { $ne: true }, role: { $ne: 'head' } };
    if (session.role === 'lead') {
        userMatch.team = session.team;
    } else if (teamFilter) {
        userMatch.team = teamFilter;
    }

    const members = await db.collection('users')
        .find(userMatch).project({ name: 1, role: 1, team: 1 }).sort({ name: 1 }).toArray();

    const reports = await Promise.all(
        members.map(async (m) => ({
            user: { _id: m._id, name: m.name, role: m.role, team: m.team },
            ...(await buildDailyReport(db, m._id, date)),
        }))
    );

    return NextResponse.json({ date, reports });
}
