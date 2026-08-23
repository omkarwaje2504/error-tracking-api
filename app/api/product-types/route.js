import { connectDB } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const types = await db.collection('productTypes')
        .find({ deleted: { $ne: true } }).sort({ name: 1 }).toArray();
    return NextResponse.json(types);
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
    const existing = await db.collection('productTypes').findOne({
        deleted: { $ne: true },
        name: { $regex: `^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    if (existing) return NextResponse.json(existing);

    const doc = { name: trimmed, deleted: false, createdAt: new Date(), createdBy: session.id };
    const { insertedId } = await db.collection('productTypes').insertOne(doc);
    return NextResponse.json({ _id: insertedId, ...doc });
}
