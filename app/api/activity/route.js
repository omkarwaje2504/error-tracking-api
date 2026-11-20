import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'head') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const limit = Math.min(Number(new URL(req.url).searchParams.get('limit')) || 30, 100);

    const entries = await query(
        `SELECT a.*, CASE WHEN p."_id" IS NULL THEN NULL ELSE json_build_object('_id', p."_id", 'name', p."name") END AS "project"
         FROM activity a LEFT JOIN projects p ON p."_id" = a."project"
         ORDER BY a."createdAt" DESC
         LIMIT $1`,
        [limit]
    );

    return NextResponse.json(entries);
}
