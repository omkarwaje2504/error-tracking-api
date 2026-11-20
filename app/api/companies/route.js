import { query, insertRow, where } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { addSinceFilter } from '@/lib/sinceQuery';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const since = new URL(req.url).searchParams.get('since');
    const w = addSinceFilter(where(), since);
    const companies = await query(`SELECT * FROM companies ${w.sql} ORDER BY "createdAt" DESC`, w.params);
    return NextResponse.json(companies);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { name } = await req.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const now = new Date();
    const company = await insertRow('companies', { name: name.trim(), deleted: false, createdAt: now, updatedAt: now });
    return NextResponse.json(company);
}
