import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { NextResponse } from 'next/server';

const USER_FIELDS = { name: 1, team: 1, role: 1 };

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();

    const params = new URL(req.url).searchParams;
    const brandId = params.get('brand');
    const companyId = params.get('company');
    const statusFilter = params.get('status'); // 'active' | 'completed' | 'all'
    const page = params.get('page') ? Math.max(1, parseInt(params.get('page'), 10) || 1) : null;
    const limit = params.get('limit') ? Math.min(200, Math.max(1, parseInt(params.get('limit'), 10) || 50)) : null;

    const match = { deleted: { $ne: true } };
    if (brandId) match.brand = oid(brandId);
    if (statusFilter === 'active') match.status = { $ne: 'completed' };
    else if (statusFilter === 'completed') match.status = 'completed';
    if (companyId) {
        const companyBrands = await db.collection('brands')
            .find({ company: oid(companyId), deleted: { $ne: true } }).project({ _id: 1 }).toArray();
        match.$or = [
            { company: oid(companyId) },
            { brand: { $in: companyBrands.map((b) => b._id) } },
        ];
    }

    const total = (page || limit) ? await db.collection('projects').countDocuments(match) : null;

    const projects = await db.collection('projects').aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        ...(limit ? [{ $skip: ((page || 1) - 1) * limit }, { $limit: limit }] : []),
        { $lookup: { from: 'brands', localField: 'brand', foreignField: '_id', as: 'brand' } },
        { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'companies', localField: 'company', foreignField: '_id', as: 'company' } },
        { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'companies', localField: 'brand.company', foreignField: '_id', as: 'brand.company',
            }
        },
        { $unwind: { path: '$brand.company', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'salesPerson', foreignField: '_id', as: 'salesPerson', pipeline: [{ $project: USER_FIELDS }] } },
        { $unwind: { path: '$salesPerson', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'servicePerson', foreignField: '_id', as: 'servicePerson', pipeline: [{ $project: USER_FIELDS }] } },
        { $unwind: { path: '$servicePerson', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                name: 1, description: 1, createdAt: 1, updatedAt: 1, deadline: 1, status: 1, link: 1,
                client: 1, projectType: 1,
                'brand._id': 1, 'brand.name': 1, 'brand.company.name': 1,
                'company._id': 1, 'company.name': 1,
                'salesPerson._id': 1, 'salesPerson.name': 1,
                'servicePerson._id': 1, 'servicePerson.name': 1,
                sectionCount: { $size: { $ifNull: ['$sections', []] } },
            }
        },
    ]).toArray();

    if (total !== null) {
        return NextResponse.json({ projects, total, page: page || 1, limit: limit || total, totalPages: limit ? Math.ceil(total / limit) : 1 });
    }
    return NextResponse.json(projects);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const {
        name, description, brand, company, client, salesPerson, servicePerson,
        projectType, deadline, link, status,
    } = await req.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const now = new Date();
    const doc = {
        name, description,
        brand: brand ? oid(brand) : null,
        company: company ? oid(company) : null,
        client: client || '',
        salesPerson: salesPerson ? oid(salesPerson) : null,
        servicePerson: servicePerson ? oid(servicePerson) : null,
        projectType: projectType || '',
        deadline: deadline || null,
        link: link || '',
        status: status || 'active',
        attachments: [],
        sections: [],
        createdBy: oid(session.id),
        deleted: false,
        createdAt: now,
        updatedAt: now,
    };
    const { insertedId } = await db.collection('projects').insertOne(doc);

    await logActivity(db, {
        type: 'project.created',
        message: `${session.name} created project "${name}"`,
        project: insertedId,
        user: session.id,
    });

    return NextResponse.json({ _id: insertedId, ...doc });
}
