

import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const companyId = new URL(req.url).searchParams.get('company');

    const match = { deleted: { $ne: true } };
    if (companyId) match.company = oid(companyId);

    const brands = await db.collection('brands').aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $lookup: { from: 'companies', localField: 'company', foreignField: '_id', as: 'company' } },
        { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
        { $project: { name: 1, description: 1, createdAt: 1, 'company._id': 1, 'company.name': 1 } },
    ]).toArray();

    return NextResponse.json(brands);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { name, description, company } = await req.json();
    const doc = {
        name, description,
        company: company ? oid(company) : null,
        deleted: false, createdAt: new Date(),
    };
    const { insertedId } = await db.collection('brands').insertOne(doc);
    return NextResponse.json({ _id: insertedId, ...doc });
}