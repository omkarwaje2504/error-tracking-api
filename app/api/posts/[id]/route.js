import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { POST_STATUSES } from '@/lib/posts';
import { postFields } from '@/lib/postFields';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const body = await req.json();

    const existing = await db.collection('posts').findOne({ _id: oid(id), deleted: { $ne: true } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const set = { ...postFields(body), updatedAt: new Date() };
    if (set.title === '') return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    let markedPosted = false;
    if (body.status !== undefined) {
        if (!POST_STATUSES.includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        set.status = body.status;
        if (body.status !== existing.status) {
            markedPosted = body.status === 'posted';
            set.postedAt = markedPosted ? new Date() : null;
            set.postedByName = markedPosted ? session.name : null;
        }
    }

    await db.collection('posts').updateOne({ _id: oid(id) }, { $set: set });
    const post = await db.collection('posts').findOne({ _id: oid(id) });

    if (markedPosted) {
        await logActivity(db, {
            type: 'post.posted',
            message: `${session.name} marked post "${post.title}" as posted`,
            user: session.id,
        });
    }

    return NextResponse.json(post);
}

export async function DELETE(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;

    const existing = await db.collection('posts').findOne({ _id: oid(id), deleted: { $ne: true } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const isManager = session.role === 'lead' || session.role === 'head';
    if (!isManager && String(existing.createdBy) !== String(session.id)) {
        return NextResponse.json({ error: 'Only the creator or a lead can delete this post.' }, { status: 403 });
    }

    // Soft delete, like tasks/projects — attachments stay in R2.
    await db.collection('posts').updateOne({ _id: oid(id) }, { $set: { deleted: true, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
}
