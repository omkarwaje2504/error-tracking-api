import { S3Client } from '@aws-sdk/client-s3';

// Cloudflare R2 is S3-compatible. Configure via env vars:
//   R2_ACCOUNT_ID        - Cloudflare account id
//   R2_ACCESS_KEY_ID     - R2 API token access key id
//   R2_SECRET_ACCESS_KEY - R2 API token secret
//   R2_BUCKET            - bucket name to upload into
//   R2_PUBLIC_URL        - public base URL for the bucket (custom domain or r2.dev URL),
//                          used to build the URL we save on documents. No trailing slash.

export function r2Configured() {
    return !!(
        process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET &&
        process.env.R2_PUBLIC_URL
    );
}

let client;
export function getR2Client() {
    if (!client) {
        client = new S3Client({
            region: 'auto',
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
        });
    }
    return client;
}

export const R2_BUCKET = () => process.env.R2_BUCKET;
export const R2_PUBLIC_URL = () => process.env.R2_PUBLIC_URL;
