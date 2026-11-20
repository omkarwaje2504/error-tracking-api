import { query, insertRow, where } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { POST_STATUSES } from '@/lib/posts';
import { postFields, DATE_RE } from '@/lib/postFields';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const params = new URL(req.url).searchParams;
    const status = params.get('status');
    // Inclusive YYYY-MM-DD bounds — postDate is a plain date string, so a
    // lexical range compare is exact.
    const from = params.get('from');
    const to = params.get('to');

    const w = where().add('NOT "deleted"');
    if (POST_STATUSES.includes(status)) w.add('"status" = $?', status);
    if (DATE_RE.test(from || '')) w.add('"postDate" >= $?', from);
    if (DATE_RE.test(to || '')) w.add('"postDate" <= $?', to);

    const posts = await query(
        `SELECT "_id", "title", "postDate", "caption", "status", "attachments",
                "createdBy", "createdByName", "createdAt", "updatedAt", "postedAt", "postedByName"
         FROM posts ${w.sql}
         ORDER BY "postDate" DESC, "createdAt" DESC`,
        w.params
    );

    return NextResponse.json(posts);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const fields = postFields({ postDate: '', caption: '', attachments: [], ...body });
    if (!fields.title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const now = new Date();
    const posted = body.status === 'posted';
    const post = await insertRow('posts', {
        ...fields,
        status: posted ? 'posted' : 'pending',
        postedAt: posted ? now : null,
        postedByName: posted ? session.name : null,
        createdBy: session.id,
        createdByName: session.name,
        deleted: false,
        createdAt: now,
        updatedAt: now,
    });

    await logActivity({
        type: 'post.created',
        message: `${session.name} added post "${post.title}" for ${post.postDate}`,
        user: session.id,
    });

    return NextResponse.json(post);
}
