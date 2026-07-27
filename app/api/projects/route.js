import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

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
        { $lookup: { from: 'companies', localField: 'brand.company', foreignField: '_id', as: 'brand.company' } },
        { $unwind: { path: '$brand.company', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                name: 1, description: 1, createdAt: 1,
                'brand._id': 1, 'brand.name': 1, 'brand.company.name': 1,
            }
        },
    ]).toArray();
    return NextResponse.json(projects);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { name, description, brand } = await req.json();
    const doc = {
        name, description, brand: brand ? oid(brand) : null, createdBy: oid(session.id), deleted: false, createdAt: new Date(),
    };
    const { insertedId } = await db.collection('projects').insertOne(doc);
    return NextResponse.json({ _id: insertedId, ...doc });
}