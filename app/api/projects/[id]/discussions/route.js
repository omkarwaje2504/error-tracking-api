import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;

    const messages = await db.collection('discussions').aggregate([
        { $match: { project: oid(id), deleted: { $ne: true } } },
        { $sort: { createdAt: 1 } },
        { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user', pipeline: [{ $project: { name: 1 } }] } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ]).toArray();

    return NextResponse.json(messages);
}

export async function POST(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const { message, attachments } = await req.json();
    if (!message || !message.trim()) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const doc = {
        project: oid(id),
        user: oid(session.id),
        message: message.trim(),
        attachments: attachments || [],
        deleted: false,
        createdAt: new Date(),
    };
    const { insertedId } = await db.collection('discussions').insertOne(doc);

    const project = await db.collection('projects').findOne({ _id: oid(id) }, { projection: { name: 1 } });
    await logActivity(db, {
        type: 'discussion.posted',
        message: `${session.name} commented on "${project?.name || 'a project'}"`,
        project: oid(id),
        user: session.id,
    });

    return NextResponse.json({ _id: insertedId, ...doc, user: { _id: session.id, name: session.name } });
}
