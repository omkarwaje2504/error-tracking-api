import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSession } from '@/lib/auth';
import { getR2Client, r2Configured, R2_BUCKET, R2_PUBLIC_URL } from '@/lib/r2';
import { NextResponse } from 'next/server';

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!r2Configured()) {
        return NextResponse.json(
            { error: 'File storage is not configured yet. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL in .env.' },
            { status: 503 }
        );
    }

    const form = await req.formData();
    const files = form.getAll('file');
    if (!files.length) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const uploaded = [];
    for (const file of files) {
        if (typeof file === 'string') continue;
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: `${file.name} is larger than 25MB` }, { status: 400 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `projects/${session.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

        await getR2Client().send(new PutObjectCommand({
            Bucket: R2_BUCKET(),
            Key: key,
            Body: buffer,
            ContentType: file.type || 'application/octet-stream',
        }));

        uploaded.push({
            name: file.name,
            url: `${R2_PUBLIC_URL()}/${key}`,
            key,
            size: file.size,
            type: file.type || '',
        });
    }

    return NextResponse.json({ files: uploaded });
}
