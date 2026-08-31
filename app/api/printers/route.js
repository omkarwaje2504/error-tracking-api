import { connectDB } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { sinceMatch } from '@/lib/sinceQuery';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const since = new URL(req.url).searchParams.get('since');
    const printers = await db.collection('printers')
        .find(sinceMatch(since)).sort({ name: 1 }).toArray();
    return NextResponse.json(printers);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { name, email_id, printer_type, page_color, file_type, page_type, file_sizes } = await req.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email_id || !email_id.trim()) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    const trimmed = name.trim();
    const email_trimmed = email_id.trim();

    // Typing an existing name (case-insensitive) just returns it instead of duplicating.
    const existing = await db.collection('printers').findOne({
        deleted: { $ne: true },
        name: { $regex: `^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        email_id: email_trimmed,
    });
    if (existing) return NextResponse.json(existing);

    const now = new Date();
    const doc = {
        name: trimmed, email_id: email_trimmed,
        printer_type: (printer_type || '').trim(),
        page_color: (page_color || '').trim(),
        file_type: (file_type || '').trim(),
        page_type: (page_type || '').trim(),
        file_sizes: Array.isArray(file_sizes) ? file_sizes.map((s) => String(s).trim()).filter(Boolean) : [],
        deleted: false, createdAt: now, updatedAt: now, createdBy: session.id,
    };
    const { insertedId } = await db.collection('printers').insertOne(doc);
    return NextResponse.json({ _id: insertedId, ...doc });
}
