import { query } from '@/lib/db';

// { _id, name } of the task's project, or null — same shape the Mongo
// $lookup + $unwind produced.
const PROJECT_JSON = `CASE WHEN p."_id" IS NULL THEN NULL ELSE json_build_object('_id', p."_id", 'name', p."name") END AS "project"`;

/**
 * Everything one person's daily report needs: what they finished today,
 * what's still open, and — attached to each task — its subtasks and any
 * quantity logged today, so the UI can render "Task (subtask, subtask)" /
 * "Task (12 completed, 1 declined)" in one line.
 */
export async function buildDailyReport(userId, dateStr) {
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const completedToday = await query(
        `SELECT t."_id", t."title", ${PROJECT_JSON}
         FROM tasks t LEFT JOIN projects p ON p."_id" = t."project"
         WHERE NOT t."deleted" AND $1 = ANY(t."assignedTo") AND t."status" = 'completed'
           AND t."completedAt" BETWEEN $2 AND $3 AND t."parentTask" IS NULL
         ORDER BY t."completedAt" DESC`,
        [userId, startOfDay, endOfDay]
    );

    // "Still open" includes tasks marked done but not yet lead-approved —
    // from this person's perspective it isn't closed out yet either.
    const pending = await query(
        `SELECT t."_id", t."title", t."dueDate", t."priority", ${PROJECT_JSON}
         FROM tasks t LEFT JOIN projects p ON p."_id" = t."project"
         WHERE NOT t."deleted" AND $1 = ANY(t."assignedTo") AND t."status" IN ('pending', 'done')
           AND t."parentTask" IS NULL
         ORDER BY t."dueDate" ASC NULLS FIRST, t."createdAt" DESC
         LIMIT 20`,
        [userId]
    );

    // Quantity logged today, across ALL of this person's tasks — not just the
    // lists above, so a batch update on a task outside the top-20 pending
    // list still shows up in the report.
    const progressRows = await query(
        `SELECT "task" AS "_id", SUM("added")::int AS "added", SUM("completed")::int AS "completed", SUM("declined")::int AS "declined"
         FROM progress
         WHERE "user" = $1 AND "date" = $2 AND NOT "deleted"
         GROUP BY "task"`,
        [userId, dateStr]
    );
    const progressByTask = {};
    progressRows.forEach((p) => { progressByTask[p._id] = p; });

    const known = new Set([...completedToday, ...pending].map((t) => t._id));
    const extraIds = progressRows.map((p) => p._id).filter((id) => id && !known.has(id));
    let extras = [];
    if (extraIds.length) {
        extras = await query(
            `SELECT t."_id", t."title", t."status", t."dueDate", t."priority", ${PROJECT_JSON}
             FROM tasks t LEFT JOIN projects p ON p."_id" = t."project"
             WHERE t."_id" = ANY($1) AND NOT t."deleted"`,
            [extraIds]
        );
    }
    const pendingAll = [...pending, ...extras.filter((t) => t.status !== 'completed')];

    // Subtasks for everything we're about to show.
    const allIds = [...completedToday, ...pendingAll].map((t) => t._id);
    const subs = allIds.length
        ? await query(
            `SELECT "title", "status", "parentTask" FROM tasks WHERE "parentTask" = ANY($1) AND NOT "deleted"`,
            [allIds]
        )
        : [];
    const subsByParent = {};
    subs.forEach((s) => {
        (subsByParent[s.parentTask] ||= []).push({ title: s.title, done: s.status === 'completed' });
    });

    function enrich(t) {
        return {
            ...t,
            subtasks: subsByParent[t._id] || [],
            progress: progressByTask[t._id] || null,
        };
    }

    return {
        completedToday: completedToday.map(enrich),
        pending: pendingAll.map(enrich),
    };
}
