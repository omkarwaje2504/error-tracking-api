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
    const { name } = await req.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const trimmed = name.trim();

    // Typing an existing name (case-insensitive) just returns it instead of duplicating.
    const existing = await db.collection('printers').findOne({
        deleted: { $ne: true },
        name: { $regex: `^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    if (existing) return NextResponse.json(existing);

    const now = new Date();
    const doc = { name: trimmed, deleted: false, createdAt: now, updatedAt: now, createdBy: session.id };
    const { insertedId } = await db.collection('printers').insertOne(doc);
    return NextResponse.json({ _id: insertedId, ...doc });
}
