import { queryOne, updateRow } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { POST_STATUSES } from '@/lib/posts';
import { postFields } from '@/lib/postFields';
import { NextResponse } from 'next/server';

function findLivePost(id) {
    return queryOne(`SELECT * FROM posts WHERE "_id" = $1 AND NOT "deleted"`, [id]);
}

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await req.json();

    const existing = await findLivePost(id);
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

    const post = await updateRow('posts', id, set);

    if (markedPosted) {
        await logActivity({
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
    const { id } = await params;

    const existing = await findLivePost(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const isManager = session.role === 'lead' || session.role === 'head';
    if (!isManager && existing.createdBy !== session.id) {
        return NextResponse.json({ error: 'Only the creator or a lead can delete this post.' }, { status: 403 });
    }

    // Soft delete, like tasks/projects — attachments stay in R2.
    await updateRow('posts', id, { deleted: true, updatedAt: new Date() });
    return NextResponse.json({ ok: true });
}
