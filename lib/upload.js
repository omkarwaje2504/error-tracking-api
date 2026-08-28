'use client';

/**
 * Uploads one file straight from the browser to R2: ask our server for a
 * presigned PUT URL (no file bytes involved), then PUT the file directly
 * to that URL. Our server never sees the file itself.
 */
async function uploadOne(file) {
    const presignRes = await fetch('/api/upload/presign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size }),
    });
    const presign = await presignRes.json();
    if (!presignRes.ok) throw new Error(presign.error || `Could not prepare "${file.name}" for upload.`);

    const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
    });
    if (!putRes.ok) throw new Error(`Upload failed for "${file.name}".`);

    return { name: file.name, url: presign.publicUrl, key: presign.key, size: file.size, type: file.type || '' };
}

/**
 * Uploads every file in a FileList/array, browser → R2 directly.
 * Never throws — returns { uploaded, errors } so a partial batch failure
 * (one bad file among several) doesn't lose the files that did succeed.
 */
export async function uploadFilesToR2(fileList) {
    const files = Array.from(fileList || []);
    const uploaded = [];
    const errors = [];
    for (const file of files) {
        try {
            uploaded.push(await uploadOne(file));
        } catch (err) {
            errors.push({ name: file.name, message: err.message || 'Upload failed.' });
        }
    }
    return { uploaded, errors };
}
