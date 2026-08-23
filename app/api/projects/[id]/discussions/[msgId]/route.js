import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function DELETE(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { msgId } = await params;

    const msg = await db.collection('discussions').findOne({ _id: oid(msgId) });
    if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const canDelete = String(msg.user) === session.id || session.role === 'lead' || session.role === 'head';
    if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await db.collection('discussions').updateOne({ _id: oid(msgId) }, { $set: { deleted: true } });
    return NextResponse.json({ ok: true });
}
