import { query, queryOne, insertRow, where } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { addSinceFilter } from '@/lib/sinceQuery';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const params = new URL(req.url).searchParams;
    const companyId = params.get('company');
    const since = params.get('since');

    const w = addSinceFilter(where(), since, 'b');
    if (companyId) w.add('b."company" = $?', companyId);

    const brands = await query(
        `SELECT b."_id", b."name", b."createdAt", b."deleted",
                CASE WHEN c."_id" IS NULL THEN NULL ELSE json_build_object('_id', c."_id", 'name', c."name") END AS "company"
         FROM brands b LEFT JOIN companies c ON c."_id" = b."company"
         ${w.sql}
         ORDER BY b."createdAt" DESC`,
        w.params
    );

    return NextResponse.json(brands);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { name, company } = await req.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    let companyDoc = null;
    if (company) {
        companyDoc = await queryOne(`SELECT * FROM companies WHERE "_id" = $1`, [company]);
        if (companyDoc && companyDoc.name.trim().toLowerCase() === name.trim().toLowerCase()) {
            return NextResponse.json({ error: 'A brand cannot have the same name as its company' }, { status: 400 });
        }
    }

    const now = new Date();
    const brand = await insertRow('brands', {
        name: name.trim(),
        company: company || null,
        deleted: false, createdAt: now, updatedAt: now,
    });
    return NextResponse.json({ ...brand, company: companyDoc });
}
