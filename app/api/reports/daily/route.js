import { connectDB } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { buildDailyReport } from '@/lib/reportBuilder';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const date = new URL(req.url).searchParams.get('date') || new Date().toISOString().slice(0, 10);

    const report = await buildDailyReport(db, session.id, date);

    return NextResponse.json({
        user: { name: session.name, role: session.role },
        date,
        ...report,
    });
}
