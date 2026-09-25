import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { logId } = await params;
    const { date, added, completed, declined, j2k, note } = await req.json();

    const set = {};
    if (date !== undefined) set.date = date;
    if (added !== undefined) set.added = Number(added) || 0;
    if (completed !== undefined) set.completed = Number(completed) || 0;
    if (declined !== undefined) set.declined = Number(declined) || 0;
    if (j2k !== undefined) set.j2k = Number(j2k) || 0;
    if (note !== undefined) set.note = note;

    await db.collection('progress').updateOne({ _id: oid(logId) }, { $set: set });
    return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { logId } = await params;
    const permanent = new URL(req.url).searchParams.get('permanent') === 'true';

    if (permanent) {
        if (session.role !== 'head')
            return NextResponse.json({ error: 'Only head can permanently delete' }, { status: 403 });
        await db.collection('progress').deleteOne({ _id: oid(logId) });
        return NextResponse.json({ ok: true, permanent: true });
    }
    await db.collection('progress').updateOne({ _id: oid(logId) }, { $set: { deleted: true } });
    return NextResponse.json({ ok: true });
}