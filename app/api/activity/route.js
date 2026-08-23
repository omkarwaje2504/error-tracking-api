import { connectDB } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'head') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const db = await connectDB();
    const limit = Math.min(Number(new URL(req.url).searchParams.get('limit')) || 30, 100);

    const entries = await db.collection('activity').aggregate([
        { $sort: { createdAt: -1 } },
        { $limit: limit },
        { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'project', pipeline: [{ $project: { name: 1 } }] } },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
    ]).toArray();

    return NextResponse.json(entries);
}
