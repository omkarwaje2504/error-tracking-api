import { query, queryOne, updateRow, findById } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { PROJECT_STAGES } from '@/lib/projectStages';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    // Whole project row, with brand/company joined in as full rows and the
    // creator as { _id, name, team, role } — the shape the detail page uses.
    const project = await queryOne(
        `SELECT p.*,
                to_jsonb(b) AS "brand",
                to_jsonb(c) AS "company",
                CASE WHEN u."_id" IS NULL THEN NULL ELSE json_build_object('_id', u."_id", 'name', u."name", 'team', u."team", 'role', u."role") END AS "createdBy"
         FROM projects p
         LEFT JOIN brands b ON b."_id" = p."brand"
         LEFT JOIN companies c ON c."_id" = p."company"
         LEFT JOIN users u ON u."_id" = p."createdBy"
         WHERE p."_id" = $1`,
        [id]
    );

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(project);
}

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await req.json();

    const existing = await findById('projects', id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const set = { updatedAt: new Date() };
    if (body.name !== undefined) set.name = body.name;
    if (body.description !== undefined) set.description = body.description;
    if (body.brand !== undefined) set.brand = body.brand || null;
    if (body.company !== undefined) set.company = body.company || null;
    if (body.client !== undefined) set.client = body.client;
    if (body.salesPerson !== undefined) set.salesPerson = body.salesPerson?.trim() || '';
    if (body.servicePerson !== undefined) set.servicePerson = body.servicePerson?.trim() || '';
    if (body.projectType !== undefined) set.projectType = body.projectType;
    if (body.deadline !== undefined) set.deadline = body.deadline || null;
    if (body.link !== undefined) set.link = body.link;
    if (body.status !== undefined) set.status = body.status;
    if (body.pinned !== undefined) set.pinned = !!body.pinned;
    if (body.currentStage !== undefined) set.currentStage = PROJECT_STAGES.includes(body.currentStage) ? body.currentStage : '';
    if (body.attachments !== undefined) set.attachments = body.attachments || [];
    if (body.sections !== undefined) set.sections = body.sections || [];
    if (body.kickoff !== undefined) set.kickoff = body.kickoff;

    const project = await updateRow('projects', id, set);

    if (set.status && set.status !== existing.status) {
        await logActivity({
            type: 'project.status_changed',
            message: `${session.name} moved "${project.name}" to ${set.status}`,
            project: project._id,
            user: session.id,
        });
    }

    return NextResponse.json(project);
}

export async function DELETE(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const permanent = new URL(req.url).searchParams.get('permanent') === 'true';

    if (permanent) {
        if (session.role !== 'head')
            return NextResponse.json({ error: 'Only head can permanently delete' }, { status: 403 });
        await query(`DELETE FROM projects WHERE "_id" = $1`, [id]);
        return NextResponse.json({ ok: true, permanent: true });
    }
    await updateRow('projects', id, { deleted: true });
    return NextResponse.json({ ok: true });
}
