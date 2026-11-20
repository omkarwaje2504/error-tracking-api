import { query, queryOne, insertRow, where } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { PROJECT_STAGES } from '@/lib/projectStages';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = new URL(req.url).searchParams;
    const brandId = params.get('brand');
    const companyId = params.get('company');
    const statusFilter = params.get('status'); // 'active' | 'completed' | 'all'
    // A PROJECT_STAGES value, or 'none' for projects with no current stage.
    const stageParam = params.get('stage');
    // Show only this one product type — takes priority over excludeTypes.
    const productTypeParam = params.get('productType');
    // Comma-separated product type names to hide, e.g. "Rx-pad,Poster". An
    // empty-string entry (from a trailing/leading comma) means "no type set".
    const excludeTypesParam = params.get('excludeTypes');
    const page = params.get('page') ? Math.max(1, parseInt(params.get('page'), 10) || 1) : null;
    const limit = params.get('limit') ? Math.min(200, Math.max(1, parseInt(params.get('limit'), 10) || 50)) : null;

    const w = where().add('NOT p."deleted"');
    if (brandId) w.add('p."brand" = $?', brandId);
    if (statusFilter === 'active') w.add(`p."status" IS DISTINCT FROM 'completed'`);
    else if (statusFilter === 'completed') w.add(`p."status" = 'completed'`);
    if (stageParam === 'none') w.add(`coalesce(p."currentStage", '') = ''`);
    else if (stageParam) w.add('p."currentStage" = $?', stageParam);
    if (productTypeParam) {
        w.add('p."projectType" = $?', productTypeParam);
    } else if (excludeTypesParam) {
        const excludeTypes = excludeTypesParam.split(',');
        // Projects created before `projectType` existed have it null rather
        // than '' — hiding "no type" ('' in the list) hides those too.
        if (excludeTypes.includes('')) w.add(`coalesce(p."projectType", '') <> ALL($?)`, excludeTypes);
        else w.add(`(p."projectType" IS NULL OR p."projectType" <> ALL($?))`, excludeTypes);
    }
    if (companyId) {
        w.add(
            `(p."company" = $? OR p."brand" IN (SELECT "_id" FROM brands WHERE "company" = $? AND NOT "deleted"))`,
            companyId, companyId
        );
    }

    const total = (page || limit)
        ? (await queryOne(`SELECT count(*)::int AS n FROM projects p ${w.sql}`, w.params)).n
        : null;

    const paging = limit ? `LIMIT ${w.next(limit)} OFFSET ${w.next(((page || 1) - 1) * limit)}` : '';

    const projects = await query(
        `SELECT p."_id", p."name", p."description", p."createdAt", p."updatedAt", p."deadline", p."status", p."link",
                p."client", p."projectType", p."pinned", p."currentStage", p."salesPerson", p."servicePerson",
                CASE WHEN b."_id" IS NULL THEN NULL ELSE json_build_object(
                    '_id', b."_id", 'name', b."name",
                    'company', CASE WHEN bc."_id" IS NULL THEN NULL ELSE json_build_object('name', bc."name") END
                ) END AS "brand",
                CASE WHEN c."_id" IS NULL THEN NULL ELSE json_build_object('_id', c."_id", 'name', c."name") END AS "company",
                jsonb_array_length(coalesce(p."sections", '[]'::jsonb)) AS "sectionCount"
         FROM projects p
         LEFT JOIN brands b ON b."_id" = p."brand"
         LEFT JOIN companies bc ON bc."_id" = b."company"
         LEFT JOIN companies c ON c."_id" = p."company"
         ${w.sql}
         ORDER BY p."pinned" DESC, p."createdAt" DESC
         ${paging}`,
        w.params
    );

    if (total !== null) {
        return NextResponse.json({ projects, total, page: page || 1, limit: limit || total, totalPages: limit ? Math.ceil(total / limit) : 1 });
    }
    return NextResponse.json(projects);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const {
        name, description, brand, company, client, salesPerson, servicePerson,
        projectType, deadline, link, status, currentStage,
    } = await req.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const now = new Date();
    const project = await insertRow('projects', {
        name, description,
        brand: brand || null,
        company: company || null,
        client: client || '',
        salesPerson: salesPerson?.trim() || '',
        servicePerson: servicePerson?.trim() || '',
        projectType: projectType || '',
        deadline: deadline || null,
        link: link || '',
        status: status || 'active',
        // Where the project currently sits in its journey — a quick-glance/
        // quick-edit field on the list, separate from the detail page's
        // multi-section journey (kickoff/design/development/production/…).
        currentStage: PROJECT_STAGES.includes(currentStage) ? currentStage : '',
        pinned: false,
        attachments: [],
        sections: [],
        createdBy: session.id,
        deleted: false,
        createdAt: now,
        updatedAt: now,
    });

    await logActivity({
        type: 'project.created',
        message: `${session.name} created project "${name}"`,
        project: project._id,
        user: session.id,
    });

    return NextResponse.json(project);
}
