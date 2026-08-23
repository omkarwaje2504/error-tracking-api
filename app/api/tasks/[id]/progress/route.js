import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

// List all log entries for a task + running totals
export async function GET(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;

    const logs = await db.collection('progress').aggregate([
        { $match: { task: oid(id), deleted: { $ne: true } } },
        { $sort: { date: -1, createdAt: -1 } },
        { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { date: 1, added: 1, completed: 1, declined: 1, note: 1, createdAt: 1, 'user.name': 1 } },
    ]).toArray();

    const totals = logs.reduce(
        (acc, l) => ({
            added: acc.added + (l.added || 0),
            completed: acc.completed + (l.completed || 0),
            declined: acc.declined + (l.declined || 0),
        }),
        { added: 0, completed: 0, declined: 0 }
    );

    return NextResponse.json({ logs, totals });
}

// Add a day's entry — added (new batch), completed (done), declined (rejected / sent back for rework)
export async function POST(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const { date, added, completed, declined, note } = await req.json();

    const doc = {
        task: oid(id),
        date: date || new Date().toISOString().slice(0, 10),
        added: Number(added) || 0,
        completed: Number(completed) || 0,
        declined: Number(declined) || 0,
        note: note || '',
        user: oid(session.id),
        deleted: false,
        createdAt: new Date(),
    };
    const { insertedId } = await db.collection('progress').insertOne(doc);
    return NextResponse.json({ _id: insertedId, ...doc });
}
