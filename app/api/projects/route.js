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

    const brandId = new URL(req.url).searchParams.get('brand');
    const match = { deleted: { $ne: true } };
    if (brandId) match.brand = oid(brandId);

    const projects = await db.collection('projects').aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
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
