import { todayStr } from '@/lib/posts';

// Server-only — kept apart from lib/posts.js so the page can import the
// shared constants without pulling in server code.

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Shared field cleanup for create + update — only keys present in `body` are returned. */
export function postFields(body) {
    const set = {};
    if (body.title !== undefined) set.title = String(body.title || '').trim();
    if (body.postDate !== undefined) set.postDate = DATE_RE.test(body.postDate || '') ? body.postDate : todayStr();
    if (body.caption !== undefined) set.caption = String(body.caption || '');
    if (body.attachments !== undefined) {
        set.attachments = (Array.isArray(body.attachments) ? body.attachments : [])
            .filter((a) => a && a.url)
            .map(({ name, url, key, size, type }) => ({ name: name || 'file', url, key: key || '', size: size || 0, type: type || '' }));
    }
    return set;
}
