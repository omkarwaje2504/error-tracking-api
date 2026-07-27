import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const body = await req.json();

    const set = {};
    if (body.title !== undefined) set.title = body.title;
    if (body.description !== undefined) set.description = body.description;
    if (body.status !== undefined) set.status = body.status;
    if (body.project !== undefined) set.project = oid(body.project);
    if (body.assignedTo !== undefined) set.assignedTo = body.assignedTo.map(oid);
    if (body.trackProgress !== undefined) set.trackProgress = !!body.trackProgress;
    if (body.unit !== undefined) set.unit = body.unit;
    if (body.target !== undefined) set.target = body.target ? Number(body.target) : null;
    if (body.parentTask !== undefined) set.parentTask = body.parentTask ? oid(body.parentTask) : null;
    if (body.department !== undefined) set.department = body.department;

    await db.collection('tasks').updateOne({ _id: oid(id) }, { $set: set });
    const task = await db.collection('tasks').findOne({ _id: oid(id) });
    return NextResponse.json(task);
}

export async function DELETE(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const permanent = new URL(req.url).searchParams.get('permanent') === 'true';

    if (permanent) {
        if (session.role !== 'head')
            return NextResponse.json({ error: 'Only head can permanently delete' }, { status: 403 });
        await db.collection('tasks').deleteOne({ _id: oid(id) });
        return NextResponse.json({ ok: true, permanent: true });
    }
    await db.collection('tasks').updateOne({ _id: oid(id) }, { $set: { deleted: true } });
    await db.collection('tasks').updateMany({ parentTask: oid(id) }, { $set: { deleted: true } });
    return NextResponse.json({ ok: true });
}