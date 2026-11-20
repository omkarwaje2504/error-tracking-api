import { query, queryOne, insertRow, where } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { addSinceFilter } from '@/lib/sinceQuery';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const since = new URL(req.url).searchParams.get('since');
    const w = addSinceFilter(where(), since);
    const types = await query(`SELECT * FROM product_types ${w.sql} ORDER BY "createdAt" DESC`, w.params);
    return NextResponse.json(types);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { name } = await req.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const trimmed = name.trim();

    // Typing an existing name (case-insensitive) just returns it instead of duplicating.
    const existing = await queryOne(
        `SELECT * FROM product_types WHERE NOT "deleted" AND lower("name") = lower($1) LIMIT 1`,
        [trimmed]
    );
    if (existing) return NextResponse.json(existing);

    const now = new Date();
    const doc = await insertRow('product_types', { name: trimmed, deleted: false, createdAt: now, updatedAt: now, createdBy: session.id });
    return NextResponse.json(doc);
}
