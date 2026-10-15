import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { POST_STATUSES } from '@/lib/posts';
import { postFields, DATE_RE } from '@/lib/postFields';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const params = new URL(req.url).searchParams;
    const status = params.get('status');
    // Inclusive YYYY-MM-DD bounds — postDate is a plain date string, so a
    // lexical range compare is exact.
    const from = params.get('from');
    const to = params.get('to');

    const match = { deleted: { $ne: true } };
    if (POST_STATUSES.includes(status)) match.status = status;
    if (DATE_RE.test(from || '') || DATE_RE.test(to || '')) {
        match.postDate = {};
        if (DATE_RE.test(from || '')) match.postDate.$gte = from;
        if (DATE_RE.test(to || '')) match.postDate.$lte = to;
    }

    const posts = await db.collection('posts')
        .find(match, {
            projection: {
                title: 1, postDate: 1, caption: 1, status: 1, attachments: 1,
                createdBy: 1, createdByName: 1, createdAt: 1, updatedAt: 1, postedAt: 1, postedByName: 1,
            },
        })
        .sort({ postDate: -1, createdAt: -1 })
        .toArray();

    return NextResponse.json(posts);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const body = await req.json();
    const fields = postFields({ postDate: '', caption: '', attachments: [], ...body });
    if (!fields.title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const now = new Date();
    const posted = body.status === 'posted';
    const doc = {
        ...fields,
        status: posted ? 'posted' : 'pending',
        postedAt: posted ? now : null,
        postedByName: posted ? session.name : null,
        createdBy: oid(session.id),
        createdByName: session.name,
        deleted: false,
        createdAt: now,
        updatedAt: now,
    };
    const { insertedId } = await db.collection('posts').insertOne(doc);

    await logActivity(db, {
        type: 'post.created',
        message: `${session.name} added post "${doc.title}" for ${doc.postDate}`,
        user: session.id,
    });

    return NextResponse.json({ _id: insertedId, ...doc });
}
