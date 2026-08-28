import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const { name } = await req.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    await db.collection('printers').updateOne({ _id: oid(id) }, { $set: { name: name.trim(), updatedAt: new Date() } });
    const doc = await db.collection('printers').findOne({ _id: oid(id) });
    return NextResponse.json(doc);
}

export async function DELETE(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    await db.collection('printers').updateOne({ _id: oid(id) }, { $set: { deleted: true, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
}
