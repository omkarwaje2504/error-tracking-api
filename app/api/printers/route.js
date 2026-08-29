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
    const { name,email_id } = await req.json();
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
        email_trimmed
    });
    if (existing) return NextResponse.json(existing);

    const now = new Date();
    const doc = { name: trimmed,email_id:email_trimmed, deleted: false, createdAt: now, updatedAt: now, createdBy: session.id };
    console.log(doc);
    const { insertedId } = await db.collection('printers').insertOne(doc);
    return NextResponse.json({ _id: insertedId, ...doc });
}
