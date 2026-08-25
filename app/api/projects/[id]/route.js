import { connectDB } from '@/lib/mongodb';
import { oid } from '@/lib/objectId';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { NextResponse } from 'next/server';

const USER_FIELDS = { name: 1, team: 1, role: 1 };

export async function GET(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;

    const [project] = await db.collection('projects').aggregate([
        { $match: { _id: oid(id) } },
        { $lookup: { from: 'brands', localField: 'brand', foreignField: '_id', as: 'brand' } },
        { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'companies', localField: 'company', foreignField: '_id', as: 'company' } },
        { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'salesPerson', foreignField: '_id', as: 'salesPerson', pipeline: [{ $project: USER_FIELDS }] } },
        { $unwind: { path: '$salesPerson', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'servicePerson', foreignField: '_id', as: 'servicePerson', pipeline: [{ $project: USER_FIELDS }] } },
        { $unwind: { path: '$servicePerson', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'createdBy', foreignField: '_id', as: 'createdBy', pipeline: [{ $project: USER_FIELDS }] } },
        { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } },
    ]).toArray();

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(project);
}

export async function PUT(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await connectDB();
    const { id } = await params;
    const body = await req.json();

    const existing = await db.collection('projects').findOne({ _id: oid(id) });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const set = { updatedAt: new Date() };
    if (body.name !== undefined) set.name = body.name;
    if (body.description !== undefined) set.description = body.description;
    if (body.brand !== undefined) set.brand = body.brand ? oid(body.brand) : null;
    if (body.company !== undefined) set.company = body.company ? oid(body.company) : null;
    if (body.client !== undefined) set.client = body.client;
    if (body.salesPerson !== undefined) set.salesPerson = body.salesPerson ? oid(body.salesPerson) : null;
    if (body.servicePerson !== undefined) set.servicePerson = body.servicePerson ? oid(body.servicePerson) : null;
    if (body.projectType !== undefined) set.projectType = body.projectType;
    if (body.deadline !== undefined) set.deadline = body.deadline || null;
    if (body.link !== undefined) set.link = body.link;
    if (body.status !== undefined) set.status = body.status;
    if (body.pinned !== undefined) set.pinned = !!body.pinned;
    if (body.attachments !== undefined) set.attachments = body.attachments;
    if (body.sections !== undefined) set.sections = body.sections;
    if (body.kickoff !== undefined) set.kickoff = body.kickoff;

    await db.collection('projects').updateOne({ _id: oid(id) }, { $set: set });
    const project = await db.collection('projects').findOne({ _id: oid(id) });

    if (set.status && set.status !== existing.status) {
        await logActivity(db, {
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
    const db = await connectDB();
    const { id } = await params;
    const permanent = new URL(req.url).searchParams.get('permanent') === 'true';

    if (permanent) {
        if (session.role !== 'head')
            return NextResponse.json({ error: 'Only head can permanently delete' }, { status: 403 });
        await db.collection('projects').deleteOne({ _id: oid(id) });
        return NextResponse.json({ ok: true, permanent: true });
    }
    await db.collection('projects').updateOne({ _id: oid(id) }, { $set: { deleted: true } });
    return NextResponse.json({ ok: true });
}
