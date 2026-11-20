import { query, queryOne, insertRow } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const messages = await query(
        `SELECT d.*, CASE WHEN u."_id" IS NULL THEN NULL ELSE json_build_object('_id', u."_id", 'name', u."name") END AS "user"
         FROM discussions d LEFT JOIN users u ON u."_id" = d."user"
         WHERE d."project" = $1 AND NOT d."deleted"
         ORDER BY d."createdAt" ASC`,
        [id]
    );

    return NextResponse.json(messages);
}

export async function POST(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const { message, attachments } = await req.json();
    if (!message || !message.trim()) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const doc = await insertRow('discussions', {
        project: id,
        user: session.id,
        message: message.trim(),
        attachments: attachments || [],
        deleted: false,
        createdAt: new Date(),
    });

    const project = await queryOne(`SELECT "name" FROM projects WHERE "_id" = $1`, [id]);
    await logActivity({
        type: 'discussion.posted',
        message: `${session.name} commented on "${project?.name || 'a project'}"`,
        project: id,
        user: session.id,
    });

    return NextResponse.json({ ...doc, user: { _id: session.id, name: session.name } });
}
