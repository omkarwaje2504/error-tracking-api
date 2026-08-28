import { oid } from '@/lib/objectId';

const PROJECT_LOOKUP = [
    { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'project', pipeline: [{ $project: { name: 1 } }] } },
    { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
];

/**
 * Everything one person's daily report needs: what they finished today,
 * what's still open, and — attached to each task — its subtasks and any
 * quantity logged today, so the UI can render "Task (subtask, subtask)" /
 * "Task (12 completed, 1 declined)" in one line.
 */
export async function buildDailyReport(db, userId, dateStr) {
    const uid = oid(userId);
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const completedToday = await db.collection('tasks').aggregate([
        { $match: { deleted: { $ne: true }, assignedTo: uid, status: 'completed', completedAt: { $gte: startOfDay, $lte: endOfDay }, parentTask: { $in: [null, undefined] } } },
        ...PROJECT_LOOKUP,
        { $sort: { completedAt: -1 } },
        { $project: { title: 1, 'project.name': 1 } },
    ]).toArray();

    // "Still open" includes tasks marked done but not yet lead-approved —
    // from this person's perspective it isn't closed out yet either.
    const pending = await db.collection('tasks').aggregate([
        { $match: { deleted: { $ne: true }, assignedTo: uid, status: { $in: ['pending', 'done'] }, parentTask: { $in: [null, undefined] } } },
        ...PROJECT_LOOKUP,
        { $sort: { dueDate: 1, createdAt: -1 } },
        { $limit: 20 },
        { $project: { title: 1, dueDate: 1, priority: 1, 'project.name': 1 } },
    ]).toArray();

    // Quantity logged today, across ALL of this person's tasks — not just the
    // lists above, so a batch update on a task outside the top-20 pending
    // list still shows up in the report.
    const progressRows = await db.collection('progress').aggregate([
        { $match: { user: uid, date: dateStr, deleted: { $ne: true } } },
        { $group: { _id: '$task', added: { $sum: '$added' }, completed: { $sum: '$completed' }, declined: { $sum: '$declined' } } },
    ]).toArray();
    const progressByTask = {};
    progressRows.forEach((p) => { progressByTask[String(p._id)] = p; });

    const known = new Set([...completedToday, ...pending].map((t) => String(t._id)));
    const extraIds = progressRows.map((p) => p._id).filter((id) => !known.has(String(id)));
    let extras = [];
    if (extraIds.length) {
        extras = await db.collection('tasks').aggregate([
            { $match: { _id: { $in: extraIds }, deleted: { $ne: true } } },
            ...PROJECT_LOOKUP,
            { $project: { title: 1, status: 1, dueDate: 1, priority: 1, 'project.name': 1 } },
        ]).toArray();
    }
    const pendingAll = [...pending, ...extras.filter((t) => t.status !== 'completed')];

    // Subtasks for everything we're about to show.
    const allIds = [...completedToday, ...pendingAll].map((t) => t._id);
    const subs = allIds.length
        ? await db.collection('tasks').find({ parentTask: { $in: allIds }, deleted: { $ne: true } }).project({ title: 1, status: 1, parentTask: 1 }).toArray()
        : [];
    const subsByParent = {};
    subs.forEach((s) => {
        const key = String(s.parentTask);
        (subsByParent[key] ||= []).push({ title: s.title, done: s.status === 'completed' });
    });

    function enrich(t) {
        return {
            ...t,
            subtasks: subsByParent[String(t._id)] || [],
            progress: progressByTask[String(t._id)] || null,
        };
    }

    return {
        completedToday: completedToday.map(enrich),
        pending: pendingAll.map(enrich),
    };
}
