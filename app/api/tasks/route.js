import { query, queryOne, insertRow, where } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { NextResponse } from 'next/server';

const TEAM_MEMBER_IDS = `ARRAY(SELECT "_id" FROM users WHERE "team" = $? AND NOT "deleted")`;

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const params = new URL(req.url).searchParams;
    const projectId = params.get('project');
    const parentId = params.get('parent');
    // Children of a task (subtasks or bugs — see POST) share the parentTask
    // field; `kind` narrows which. Legacy children predate this field, so
    // "subtask" also matches rows with no kind set at all.
    const kindParam = params.get('kind');
    const teamFilter = params.get('team');
    const assigneeFilter = params.get('assignee');
    const mineOnly = params.get('mine') === 'true';
    const statusFilter = params.get('status'); // 'active' | 'done' | 'completed' | 'all'
    const priorityFilter = params.get('priority');
    const departmentFilter = params.get('department');
    // Product type comes off the task's project, not the task itself — show
    // only one type, or hide a comma-separated list (mirrors /api/projects).
    const productTypeParam = params.get('productType');
    const excludeProductTypesParam = params.get('excludeProductTypes');
    const page = params.get('page') ? Math.max(1, parseInt(params.get('page'), 10) || 1) : null;
    const limit = params.get('limit') ? Math.min(200, Math.max(1, parseInt(params.get('limit'), 10) || 50)) : null;

    const w = where().add('NOT t."deleted"');

    if (departmentFilter) w.add('t."department" = $?', departmentFilter);
    if (productTypeParam || excludeProductTypesParam) {
        let typeCond;
        let typeValue;
        if (productTypeParam) {
            typeCond = '"projectType" = $?';
            typeValue = productTypeParam;
        } else {
            const excludeTypes = excludeProductTypesParam.split(',');
            typeCond = excludeTypes.includes('')
                ? `coalesce("projectType", '') <> ALL($?)`
                : `("projectType" IS NULL OR "projectType" <> ALL($?))`;
            typeValue = excludeTypes;
        }
        w.add(`t."project" IN (SELECT "_id" FROM projects WHERE NOT "deleted" AND ${typeCond})`, typeValue);
        if (projectId) w.add('t."project" = $?', projectId);
    } else if (projectId) {
        w.add('t."project" = $?', projectId);
    }
    if (parentId) {
        w.add('t."parentTask" = $?', parentId);        // children of one task
        if (kindParam === 'bug') w.add(`t."kind" = 'bug'`);
        else if (kindParam === 'subtask') w.add(`t."kind" IS DISTINCT FROM 'bug'`);
    } else {
        w.add('t."parentTask" IS NULL'); // only top-level in main list
    }

    // Assignee scoping — later rules replace earlier ones, as before:
    // team filter < explicit assignee < "mine" / team-member self-scope.
    let assignCond = null;
    if (teamFilter) assignCond = [`t."assignedTo" && ${TEAM_MEMBER_IDS}`, teamFilter];
    if (assigneeFilter) assignCond = ['$? = ANY(t."assignedTo")', assigneeFilter];
    if (mineOnly || session.role === 'team-member') {
        // Personal "my tasks" view (dashboard) is always self-scoped,
        // regardless of role; team-members only ever see their own.
        assignCond = ['$? = ANY(t."assignedTo")', session.id];
    }
    if (assignCond) w.add(...assignCond);

    // 'active' = not yet fully signed off (pending or awaiting lead review).
    if (statusFilter === 'active') w.add(`t."status" IN ('pending', 'done')`);
    else if (statusFilter === 'done') w.add(`t."status" = 'done'`);
    else if (statusFilter === 'completed') w.add(`t."status" = 'completed'`);
    if (priorityFilter) w.add('t."priority" = $?', priorityFilter);

    if (!mineOnly && session.role === 'lead') {
        w.add(`(t."assignedTo" && ${TEAM_MEMBER_IDS} OR t."createdBy" = $?)`, session.team, session.id);
    }

    const total = (page || limit)
        ? (await queryOne(`SELECT count(*)::int AS n FROM tasks t ${w.sql}`, w.params)).n
        : null;

    const paging = limit ? `LIMIT ${w.next(limit)} OFFSET ${w.next(((page || 1) - 1) * limit)}` : '';

    const tasks = await query(
        `SELECT t."_id", t."title", t."description", t."status", t."createdAt", t."completedAt", t."revertNote",
                t."trackProgress", t."unit", t."target", t."trackJ2K", t."parentTask", t."department",
                t."priority", t."dueDate", t."stageType", t."stageId", t."attachments", t."pinned",
                t."isEvideo", t."evideoRows",
                CASE WHEN p."_id" IS NULL THEN NULL
                     ELSE json_build_object('_id', p."_id", 'name', p."name", 'projectType', p."projectType") END AS "project",
                coalesce((SELECT json_agg(json_build_object('_id', u."_id", 'name', u."name", 'team', u."team"))
                          FROM users u WHERE u."_id" = ANY(t."assignedTo")), '[]'::json) AS "assignedTo",
                CASE WHEN cb."_id" IS NULL THEN NULL ELSE json_build_object('_id', cb."_id", 'name', cb."name") END AS "createdBy",
                (SELECT json_build_object(
                            'added', coalesce(sum(pr."added"), 0), 'completed', coalesce(sum(pr."completed"), 0),
                            'declined', coalesce(sum(pr."declined"), 0), 'j2k', coalesce(sum(pr."j2k"), 0))
                 FROM progress pr WHERE pr."task" = t."_id" AND NOT pr."deleted") AS "progress",
                (SELECT json_build_object('total', count(*), 'done', count(*) FILTER (WHERE c."status" = 'completed'))
                 FROM tasks c WHERE c."parentTask" = t."_id" AND c."kind" IS DISTINCT FROM 'bug' AND NOT c."deleted") AS "subCount",
                (SELECT json_build_object('total', count(*), 'done', count(*) FILTER (WHERE c."status" = 'completed'))
                 FROM tasks c WHERE c."parentTask" = t."_id" AND c."kind" = 'bug' AND NOT c."deleted") AS "bugCount"
         FROM tasks t
         LEFT JOIN projects p ON p."_id" = t."project"
         LEFT JOIN users cb ON cb."_id" = t."createdBy"
         ${w.sql}
         ORDER BY t."createdAt" DESC
         ${paging}`,
        w.params
    );

    if (total !== null) {
        return NextResponse.json({ tasks, total, page: page || 1, limit: limit || total, totalPages: limit ? Math.ceil(total / limit) : 1 });
    }
    return NextResponse.json(tasks);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const {
        title, description, project, assignedTo, trackProgress, unit, target, trackJ2K,
        parentTask, department, priority, dueDate, stageType, stageId, attachments, kind,
        isEvideo, evideoRows,
    } = await req.json();
    if (!title || !title.trim()) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!project) {
        return NextResponse.json({ error: 'Project is required' }, { status: 400 });
    }
    const now = new Date();
    const task = await insertRow('tasks', {
        title, description,
        project: project || null,
        assignedTo: (assignedTo || []).map(String),
        createdBy: session.id,
        status: 'pending', deleted: false, createdAt: now, updatedAt: now,
        trackProgress: !!trackProgress,
        unit: unit || '',
        target: target ? Number(target) : null,
        // PVR-style tracking: same daily add/done/decline log as any other
        // trackProgress task, plus a J2K file generation count column.
        trackJ2K: !!trackJ2K,
        parentTask: parentTask || null,
        department: department || '',
        priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
        dueDate: dueDate || null,
        stageType: stageType || null,
        stageId: stageId || null,
        attachments: attachments || [],
        pinned: false,
        // EVideo language generation: a per-language assignment table instead
        // of a daily quantity log — see evideoRows shape in the PUT route.
        isEvideo: !!isEvideo,
        evideoRows: Array.isArray(evideoRows) ? evideoRows : [],
        // Only meaningful on a child (parentTask set): distinguishes a bug
        // filed against a task from a regular subtask/checklist item.
        kind: kind === 'bug' ? 'bug' : null,
    });

    if (!parentTask) {
        await logActivity({
            type: 'task.created',
            message: `${session.name} created task "${title}"`,
            project: task.project,
            task: task._id,
            user: session.id,
        });
    }

    return NextResponse.json(task);
}
