import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { sinceMatch } from '@/lib/sinceQuery';
import { NextResponse } from 'next/server';

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const params = new URL(req.url).searchParams;
    const companyId = params.get('company');
    const since = params.get('since');

    const match = sinceMatch(since);
    if (companyId) match.company = oid(companyId);

    const brands = await db.collection('brands').aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $lookup: { from: 'companies', localField: 'company', foreignField: '_id', as: 'company' } },
        { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
        { $project: { name: 1, createdAt: 1, deleted: 1, 'company._id': 1, 'company.name': 1 } },
    ]).toArray();

    return NextResponse.json(brands);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { name, company } = await req.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    let companyDoc = null;
    if (company) {
        companyDoc = await db.collection('companies').findOne({ _id: oid(company) });
        if (companyDoc && companyDoc.name.trim().toLowerCase() === name.trim().toLowerCase()) {
            return NextResponse.json({ error: 'A brand cannot have the same name as its company' }, { status: 400 });
        }
    }

    const now = new Date();
    const doc = {
        name: name.trim(),
        company: company ? oid(company) : null,
        deleted: false, createdAt: now, updatedAt: now,
    };
    const { insertedId } = await db.collection('brands').insertOne(doc);
    return NextResponse.json({ _id: insertedId, ...doc, company: companyDoc });
}
