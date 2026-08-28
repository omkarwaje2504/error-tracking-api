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

    const set = { updatedAt: new Date() };
    if (body.title !== undefined) set.title = body.title;
    if (body.description !== undefined) set.description = body.description;
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

    // Status: team members move a top-level task freely between pending and
    // done. Only a lead/head can promote it to completed, or move it *out*
    // of completed again — subtasks (have a parentTask) skip all of this
    // and keep the simple pending/completed toggle they always had.
    let statusEvent = null;
    if (body.status !== undefined) {
        const validStatuses = ['pending', 'done', 'completed'];
        if (!validStatuses.includes(body.status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }
        const isManager = session.role === 'lead' || session.role === 'head';
        const isSubtask = !!existing.parentTask;
        if (!isSubtask) {
            if (body.status === 'completed' && !isManager) {
                return NextResponse.json({ error: 'Only a lead can mark a task complete.' }, { status: 403 });
            }
            if (existing.status === 'completed' && body.status !== 'completed' && !isManager) {
                return NextResponse.json({ error: 'Only a lead can reopen a completed task.' }, { status: 403 });
            }
        }

        set.status = body.status;
        set.completedAt = body.status === 'completed' ? new Date() : null;

        if (body.status !== 'pending') {
            set.revertNote = null; // moving forward clears any stale feedback
        } else if (body.revertNote) {
            set.revertNote = { text: body.revertNote, by: session.id, byName: session.name, at: new Date() };
        } else if (body.revertNote === '') {
            set.revertNote = null;
        }

        if (body.status !== existing.status && !isSubtask) {
            if (body.status === 'done') statusEvent = { type: 'task.done', verb: 'marked done on' };
            else if (body.status === 'completed') statusEvent = { type: 'task.completed', verb: 'approved' };
            else if (body.revertNote) statusEvent = { type: 'task.reverted', verb: `sent back (${body.revertNote}) to pending` };
            else statusEvent = { type: 'task.reopened', verb: 'reopened' };
        }
    }

    await db.collection('tasks').updateOne({ _id: oid(id) }, { $set: set });
    const task = await db.collection('tasks').findOne({ _id: oid(id) });

    if (statusEvent) {
        await logActivity(db, {
            type: statusEvent.type,
            message: `${session.name} ${statusEvent.verb} task "${task.title}"`,
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
    await db.collection('tasks').updateOne({ _id: oid(id) }, { $set: { deleted: true, updatedAt: new Date() } });
    await db.collection('tasks').updateMany({ parentTask: oid(id) }, { $set: { deleted: true, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
}
