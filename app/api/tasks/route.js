import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const projectId = new URL(req.url).searchParams.get('project');
    const parentId = new URL(req.url).searchParams.get('parent');
    const teamFilter = new URL(req.url).searchParams.get('team');
    const assigneeFilter = new URL(req.url).searchParams.get('assignee');
    const mineOnly = new URL(req.url).searchParams.get('mine') === 'true';

    const match = { deleted: { $ne: true } };

    if (parentId) {
        match.parentTask = oid(parentId);        // subtasks of one task
    } else {
        match.parentTask = { $in: [null, undefined] }; // only top-level in main list
    }
    if (teamFilter) {
        const members = await db.collection('users')
            .find({ team: teamFilter, deleted: { $ne: true } }).project({ _id: 1 }).toArray();
        match.assignedTo = { $in: members.map((u) => u._id) };
    }
    if (assigneeFilter) {
        match.assignedTo = oid(assigneeFilter);
    }


    if (mineOnly) {
        // Personal "my tasks" view (dashboard) — always self-scoped, regardless of role.
        match.assignedTo = oid(session.id);
    } else if (session.role === 'team-member') {
        match.assignedTo = oid(session.id);
    } else if (session.role === 'lead') {
        const teammates = await db.collection('users')
            .find({ team: session.team, deleted: { $ne: true } }).project({ _id: 1 }).toArray();
        match.$or = [
            { assignedTo: { $in: teammates.map((u) => u._id) } },
            { createdBy: oid(session.id) },
        ];
    }

    const tasks = await db.collection('tasks').aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        {
            $lookup: {
                from: 'projects', localField: 'project', foreignField: '_id', as: 'project',
                pipeline: [
                    { $lookup: { from: 'brands', localField: 'brand', foreignField: '_id', as: 'brand' } },
                    { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
                    { $lookup: { from: 'companies', localField: 'brand.company', foreignField: '_id', as: 'brand.company' } },
                    { $unwind: { path: '$brand.company', preserveNullAndEmptyArrays: true } },
                    { $project: { name: 1, 'brand.name': 1, 'brand.company.name': 1 } },
                ],
            }
        },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'assignedTo', foreignField: '_id', as: 'assignedTo' } },
        { $lookup: { from: 'users', localField: 'createdBy', foreignField: '_id', as: 'createdBy' } },
        { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                title: 1, description: 1, status: 1, createdAt: 1, completedAt: 1,
                trackProgress: 1, unit: 1, target: 1, parentTask: 1, department: 1,
                priority: 1, dueDate: 1, stageType: 1, stageId: 1, attachments: 1,
                'project._id': 1, 'project.name': 1,
                'assignedTo._id': 1, 'assignedTo.name': 1, 'assignedTo.team': 1,
                'createdBy._id': 1, 'createdBy.name': 1,
            }
        },
        {
            $lookup: {
                from: 'progress',
                let: { taskId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$task', '$$taskId'] }, deleted: { $ne: true } } },
                    { $group: { _id: null, added: { $sum: '$added' }, completed: { $sum: '$completed' }, declined: { $sum: '$declined' } } },
                ],
                as: 'progress',
            }
        },
        {
            $lookup: {
                from: 'tasks',
                let: { taskId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$parentTask', '$$taskId'] }, deleted: { $ne: true } } },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            done: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                        }
                    },
                ],
                as: 'subCount',
            }
        },

        {
            $addFields: {
                progress: { $ifNull: [{ $arrayElemAt: ['$progress', 0] }, { added: 0, completed: 0, declined: 0 }] },
            }
        },
    ]).toArray();
    return NextResponse.json(tasks);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const {
        title, description, project, assignedTo, trackProgress, unit, target,
        parentTask, department, priority, dueDate, stageType, stageId, attachments,
    } = await req.json();
    if (!title || !title.trim()) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    const doc = {
        title, description,
        project: project ? oid(project) : null,
        assignedTo: (assignedTo || []).map(oid),
        createdBy: oid(session.id),
        status: 'pending', deleted: false, createdAt: new Date(),
        trackProgress: !!trackProgress,
        unit: unit || '',
        target: target ? Number(target) : null,
        parentTask: parentTask ? oid(parentTask) : null,
        department: department || '',
        priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
        dueDate: dueDate || null,
        stageType: stageType || null,
        stageId: stageId || null,
        attachments: attachments || [],
    };
    const { insertedId } = await db.collection('tasks').insertOne(doc);

    if (!parentTask) {
        await logActivity(db, {
            type: 'task.created',
            message: `${session.name} created task "${title}"`,
            project: doc.project,
            task: insertedId,
            user: session.id,
        });
    }

    return NextResponse.json({ _id: insertedId, ...doc });
}