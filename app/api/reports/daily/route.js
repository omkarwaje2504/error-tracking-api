import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

// Everything a "Daily Report" needs for the signed-in user: what they finished
// today, what quantity they logged today, and what's still open.
export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const userId = oid(session.id);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayStr = new Date().toISOString().slice(0, 10);

    const projectLookup = [
        { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'project', pipeline: [{ $project: { name: 1 } }] } },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
    ];

    const completedToday = await db.collection('tasks').aggregate([
        { $match: { deleted: { $ne: true }, assignedTo: userId, status: 'completed', completedAt: { $gte: startOfDay } } },
        ...projectLookup,
        { $sort: { completedAt: -1 } },
        { $project: { title: 1, 'project.name': 1 } },
    ]).toArray();

    const pending = await db.collection('tasks').aggregate([
        { $match: { deleted: { $ne: true }, assignedTo: userId, status: 'pending', parentTask: { $in: [null, undefined] } } },
        ...projectLookup,
        { $sort: { dueDate: 1, createdAt: -1 } },
        { $limit: 10 },
        { $project: { title: 1, dueDate: 1, priority: 1, 'project.name': 1 } },
    ]).toArray();

    const progressToday = await db.collection('progress').aggregate([
        { $match: { user: userId, date: todayStr, deleted: { $ne: true } } },
        { $lookup: { from: 'tasks', localField: 'task', foreignField: '_id', as: 'task' } },
        { $unwind: '$task' },
        { $lookup: { from: 'projects', localField: 'task.project', foreignField: '_id', as: 'project', pipeline: [{ $project: { name: 1 } }] } },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$task._id',
                title: { $first: '$task.title' },
                unit: { $first: '$task.unit' },
                project: { $first: '$project.name' },
                added: { $sum: '$added' },
                completed: { $sum: '$completed' },
                declined: { $sum: '$declined' },
            }
        },
    ]).toArray();

    return NextResponse.json({
        user: { name: session.name, role: session.role },
        date: todayStr,
        completedToday,
        pending,
        progressToday,
    });
}
