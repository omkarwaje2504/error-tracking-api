import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const body = await req.json();

    const existing = await db.collection('tasks').findOne({ _id: oid(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const set = {};
    if (body.title !== undefined) set.title = body.title;
    if (body.description !== undefined) set.description = body.description;
    if (body.status !== undefined) set.status = body.status;
    if (body.project !== undefined) set.project = body.project ? oid(body.project) : null;
    if (body.assignedTo !== undefined) set.assignedTo = body.assignedTo.map(oid);
    if (body.trackProgress !== undefined) set.trackProgress = !!body.trackProgress;
    if (body.unit !== undefined) set.unit = body.unit;
    if (body.target !== undefined) set.target = body.target ? Number(body.target) : null;
    if (body.parentTask !== undefined) set.parentTask = body.parentTask ? oid(body.parentTask) : null;
    if (body.department !== undefined) set.department = body.department;
    if (body.priority !== undefined) set.priority = ['low', 'medium', 'high', 'urgent'].includes(body.priority) ? body.priority : 'medium';
    if (body.dueDate !== undefined) set.dueDate = body.dueDate || null;
    if (body.stageType !== undefined) set.stageType = body.stageType || null;
    if (body.stageId !== undefined) set.stageId = body.stageId || null;
    if (body.attachments !== undefined) set.attachments = body.attachments;
    if (body.status !== undefined) set.completedAt = body.status === 'completed' ? new Date() : null;

    await db.collection('tasks').updateOne({ _id: oid(id) }, { $set: set });
    const task = await db.collection('tasks').findOne({ _id: oid(id) });

    if (set.status && set.status !== existing.status && !existing.parentTask) {
        await logActivity(db, {
            type: set.status === 'completed' ? 'task.completed' : 'task.reopened',
            message: `${session.name} ${set.status === 'completed' ? 'completed' : 'reopened'} task "${task.title}"`,
            project: task.project,
            task: task._id,
            user: session.id,
        });
    }

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
