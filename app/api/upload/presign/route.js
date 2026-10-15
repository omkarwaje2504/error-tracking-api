import { getSession } from '@/lib/auth';
import { r2Configured, R2_BUCKET, R2_PUBLIC_URL, getUploadUrl } from '@/lib/r2';
import { NextResponse } from 'next/server';

const MAX_SIZE = 225 * 1024 * 1024; // 225MB
const UPLOAD_FOLDERS = ['projects', 'posts'];

/**
 * Hands the browser a short-lived, direct-to-R2 upload URL — the file
 * bytes never touch our server. The client PUTs the file to `uploadUrl`
 * itself, then saves `publicUrl` (built from R2_PUBLIC_URL) on whatever
 * record the attachment belongs to.
 */
export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!r2Configured()) {
        return NextResponse.json(
            { error: 'File storage is not configured yet. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL in .env.' },
            { status: 503 }
        );
    }

    const { filename, contentType, size, folder } = await req.json();
    if (!filename) return NextResponse.json({ error: 'filename is required' }, { status: 400 });
    if (size && size > MAX_SIZE) {
        return NextResponse.json({ error: `${filename} is larger than 225MB` }, { status: 400 });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Top-level R2 prefix — whitelisted so callers can't write anywhere else.
    const prefix = UPLOAD_FOLDERS.includes(folder) ? folder : 'projects';
    const key = `${prefix}/${session.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

    const uploadUrl = await getUploadUrl(key, contentType);

    return NextResponse.json({
        uploadUrl,
        publicUrl: `${R2_PUBLIC_URL()}/${key}`,
        key,
        bucket: R2_BUCKET(),
    });
}
