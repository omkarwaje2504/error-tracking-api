import { query, queryOne, insertRow, where } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { addSinceFilter } from '@/lib/sinceQuery';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const since = new URL(req.url).searchParams.get('since');
    const w = addSinceFilter(where(), since);
    const printers = await query(`SELECT * FROM printers ${w.sql} ORDER BY "createdAt" DESC`, w.params);
    return NextResponse.json(printers);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { name, email_id, printerType, pageColor, fileType, fileSize, pageType } = await req.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email_id || !email_id.trim()) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    const trimmed = name.trim();
    const email_trimmed = email_id.trim();

    // Typing an existing name+email (case-insensitive) just returns it instead of duplicating.
    const existing = await queryOne(
        `SELECT * FROM printers WHERE NOT "deleted" AND lower("name") = lower($1) AND "email_id" = $2 LIMIT 1`,
        [trimmed, email_trimmed]
    );
    if (existing) return NextResponse.json(existing);

    const now = new Date();
    const doc = await insertRow('printers', {
        name: trimmed,
        email_id: email_trimmed,
        printerType: printerType?.trim() || '',
        pageColor: pageColor?.trim() || '',
        fileType: fileType?.trim() || '',
        fileSize: fileSize?.trim() || '',
        pageType: pageType?.trim() || '',
        deleted: false, createdAt: now, updatedAt: now, createdBy: session.id,
    });
    return NextResponse.json(doc);
}
