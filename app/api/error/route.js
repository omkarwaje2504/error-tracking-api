import { SourceMapConsumer } from "source-map-js";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/* ───────────────────── Route Config (Next.js 15+) ───────────────────── */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ───────────────────── Shared CORS ───────────────────── */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ───────────────────── OPTIONS ───────────────────── */

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/* ───────────────────── Helpers ───────────────────── */

/**
 * Fetch with an AbortController timeout (default 5 s).
 * Returns null instead of throwing on network/timeout errors.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch {
    return null; // timeout or network failure — caller decides what to do
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reconstruct a minimal Error from a raw stack string so that
 * stacktrace-js can parse the frames without choking.
 */
function errorFromString(stackString = "") {
  const lines = stackString.split("\n");
  const firstLine = lines[0] ?? "Error";

  let name = "Error";
  let message = firstLine;

  const colon = firstLine.indexOf(":");
  if (colon !== -1) {
    name = firstLine.slice(0, colon).trim() || "Error";
    message = firstLine.slice(colon + 1).trim();
  }

  const err = new Error(message);
  err.name = name;
  // Preserve every line so frame parsers see at-frames
  err.stack = lines.join("\n");
  return err;
}

/**
 * Return ±5 lines of context around `line` from a remote source file.
 * Returns null when the file can't be fetched.
 */
async function fetchSnippet(url, line) {
  try {
    const res = await fetchWithTimeout(url, { cache: "no-store" });
    if (!res?.ok) return null;

    const text = await res.text();
    const allLines = text.split("\n");

    const ctx = 5;
    const start = Math.max(0, line - ctx - 1);
    const end = Math.min(allLines.length, line + ctx);

    return allLines
      .slice(start, end)
      .map((l, idx) => {
        const ln = start + idx + 1;
        return ln === line
          ? `>> ${ln.toString().padStart(4)} | ${l}`
          : `   ${ln.toString().padStart(4)} | ${l}`;
      })
      .join("\n");
  } catch {
    return null;
  }
}

/* ───────────────────── Stack-trace parser (no stacktrace-js) ───────────────────── */

/**
 * Parse V8/Firefox stack frames without relying on stacktrace-js,
 * which can throw when the Error object's stack is non-standard.
 *
 * Returns: Array<{ functionName, fileName, lineNumber, columnNumber }>
 */
function parseFrames(stackString) {
  const frames = [];
  for (const raw of stackString.split("\n")) {
    const line = raw.trim();

    // V8:  "  at FnName (https://…/file.js:10:5)"
    // V8:  "  at https://…/file.js:10:5"
    const v8 = line.match(/^at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
    if (v8) {
      frames.push({
        functionName: v8[1] ?? "<anonymous>",
        fileName: v8[2],
        lineNumber: parseInt(v8[3], 10),
        columnNumber: parseInt(v8[4], 10),
      });
      continue;
    }

    // Firefox/Safari:  "fnName@https://…/file.js:10:5"
    const ff = line.match(/^(.*)@(.+):(\d+):(\d+)$/);
    if (ff) {
      frames.push({
        functionName: ff[1] || "<anonymous>",
        fileName: ff[2],
        lineNumber: parseInt(ff[3], 10),
        columnNumber: parseInt(ff[4], 10),
      });
    }
  }
  return frames;
}

/* ───────────────────── Source Map Resolver ───────────────────── */

async function mapStackTrace(minifiedStack) {
  if (!minifiedStack) return [];

  // Gracefully parse frames; never let this throw up to the caller.
  let frames;
  try {
    frames = parseFrames(minifiedStack);
  } catch {
    return [];
  }

  const out = [];

  for (const f of frames) {
    if (!f.fileName || !f.lineNumber) continue;

    let consumer = null;
    try {
      const mapURL = `${f.fileName}.map`;
      const resp = await fetchWithTimeout(mapURL, { cache: "no-store" });
      if (!resp?.ok) continue;

      let rawMap;
      try {
        rawMap = await resp.text();
      } catch {
        continue;
      }

      // source-map-js SourceMapConsumer constructor is synchronous,
      // but wrap in try/catch because malformed maps throw.
      try {
        consumer = new SourceMapConsumer(rawMap);
      } catch {
        continue;
      }

      const pos = consumer.originalPositionFor({
        line: f.lineNumber,
        column: f.columnNumber ?? 0,
      });

      if (!pos?.source || !pos?.line) continue;

      // Prefer inline source content; fall back to fetching the file.
      let snippet = null;
      try {
        const inlineContent = consumer.sourceContentFor(pos.source, true);
        if (inlineContent) {
          const allLines = inlineContent.split("\n");
          const ctx = 5;
          const start = Math.max(0, pos.line - ctx - 1);
          const end = Math.min(allLines.length, pos.line + ctx);
          snippet = allLines
            .slice(start, end)
            .map((l, idx) => {
              const ln = start + idx + 1;
              return ln === pos.line
                ? `>> ${ln.toString().padStart(4)} | ${l}`
                : `   ${ln.toString().padStart(4)} | ${l}`;
            })
            .join("\n");
        }
      } catch {
        // sourceContentFor can throw on missing sources — that's fine
      }

      // If no inline content, try fetching the original source file
      if (!snippet) {
        try {
          const absUrl = new URL(pos.source, mapURL).href;
          snippet = await fetchSnippet(absUrl, pos.line);
        } catch {
          // Malformed URL or network issue — skip snippet
        }
      }

      if (!snippet) continue;

      if (out.length) out.push({ separator: true });

      out.push({
        function: f.functionName,
        source: pos.source,
        line: pos.line,
        column: pos.column ?? 0,
        snippet: `──────── ${pos.source} ────────\n${snippet}`,
      });
    } catch {
      // Per-frame errors must never abort the whole trace
      continue;
    } finally {
      // Always destroy to prevent memory leaks, even on error paths
      try {
        consumer?.destroy?.();
      } catch {
        // ignore
      }
    }
  }

  return out;
}

/* ───────────────────── Reverse Geocode ───────────────────── */

async function reverseGeocode(lat, lon) {
  if (!lat || !lon) return {};

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("format", "json");

    const res = await fetchWithTimeout(
      url.toString(),
      { headers: { "User-Agent": "pixpro-error-tracker/1.0" } },
      8000, // slightly more generous for geocoding
    );

    if (!res?.ok) return {};

    let json;
    try {
      json = await res.json();
    } catch {
      return {};
    }

    const address = json?.address ?? {};

    return {
      city:
        address.city ||
        address.town ||
        address.village ||
        address.hamlet ||
        null,
      state: address.state || null,
      country: address.country || null,
    };
  } catch {
    return {};
  }
}

/* ───────────────────── GET ───────────────────── */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const projectId = searchParams.get("projectId");

    const client = await clientPromise;
    const collection = client.db("errors").collection("pixpro");

    /* ── Single error detail (full doc, incl. screenshot) ── */
    if (id) {
      if (!ObjectId.isValid(id)) {
        return Response.json(
          { success: false, message: "Invalid ObjectId." },
          { status: 400, headers: corsHeaders },
        );
      }

      const doc = await collection.findOne({ _id: new ObjectId(id) });

      if (!doc) {
        return Response.json(
          { success: false, message: "Error not found." },
          { status: 404, headers: corsHeaders },
        );
      }

      return Response.json(
        { success: true, data: doc },
        { headers: corsHeaders },
      );
    }

    /* ── Paginated list (no longer hard-capped at 10) ── */
    const page = Math.max(
      1,
      parseInt(searchParams.get("page") || "1", 10) || 1,
    );
    const rawLimit = parseInt(searchParams.get("limit") || "20", 10);
    // default 20, capped at 200 so a bad client can't pull the whole DB at once
    const limit =
      Number.isNaN(rawLimit) || rawLimit <= 0 ? 20 : Math.min(rawLimit, 200);
    const skip = (page - 1) * limit;

    const query = projectId ? { projectId } : {};

    const [errors, total] = await Promise.all([
      collection
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .project({ screenshot: 0 }) // list view stays light
        .toArray(),
      collection.countDocuments(query),
    ]);

    return Response.json(
      {
        success: true,
        filtered: Boolean(projectId),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        count: errors.length,
        data: errors,
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    return errorResponse(err, "Failed to fetch errors.");
  }
}

/* ───────────────────── POST ───────────────────── */

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, message: "Malformed JSON body." },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!body?.error?.message) {
      return Response.json(
        {
          success: false,
          message: "Invalid payload: error.message is required.",
        },
        { status: 400, headers: corsHeaders },
      );
    }

    // Both are safe — they return [] / {} on any internal failure
    const [mappedStack, location] = await Promise.all([
      mapStackTrace(body.error?.stack).catch(() => []),
      reverseGeocode(body.geo?.lat, body.geo?.lon).catch(() => ({})),
    ]);

    const client = await clientPromise;

    await client
      .db("errors")
      .collection("pixpro")
      .insertOne({
        projectId: body.projectId || "unknown",
        error: {
          message: body.error.message,
          name: body.error.name ?? "Error",
          stack: body.error.stack ?? null,
        },
        mappedStack,
        deviceInfo: body.deviceInfo ?? null,
        locationInfo: body.locationInfo ?? null,
        geo: body.geo ?? {},
        city: location.city ?? null,
        state: location.state ?? null,
        country: location.country ?? null,
        timestamp: new Date(),
      });

    return Response.json(
      { success: true, message: "Logged with source map." },
      { headers: corsHeaders },
    );
  } catch (err) {
    return errorResponse(err, "Failed to log error.");
  }
}

/* ───────────────────── DELETE ───────────────────── */

export async function DELETE(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, message: "Malformed JSON body." },
        { status: 400, headers: corsHeaders },
      );
    }

    const client = await clientPromise;
    const collection = client.db("errors").collection("pixpro");

    // Single ID
    if (body.id) {
      if (!ObjectId.isValid(body.id)) {
        return Response.json(
          { success: false, message: "Invalid ObjectId." },
          { status: 400, headers: corsHeaders },
        );
      }
      const result = await collection.deleteOne({ _id: new ObjectId(body.id) });
      return Response.json(
        {
          success: result.deletedCount > 0,
          message:
            result.deletedCount > 0 ? "Record deleted." : "Record not found.",
        },
        { headers: corsHeaders },
      );
    }

    // Multiple IDs
    if (Array.isArray(body.ids)) {
      const objectIds = body.ids
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

      if (!objectIds.length) {
        return Response.json(
          { success: false, message: "No valid IDs provided." },
          { status: 400, headers: corsHeaders },
        );
      }

      const result = await collection.deleteMany({ _id: { $in: objectIds } });
      return Response.json(
        { success: true, message: `Deleted ${result.deletedCount} record(s).` },
        { headers: corsHeaders },
      );
    }

    // By projectId
    if (body.projectId) {
      const result = await collection.deleteMany({ projectId: body.projectId });
      return Response.json(
        { success: true, message: `Deleted ${result.deletedCount} record(s).` },
        { headers: corsHeaders },
      );
    }

    // Nuke everything
    if (body.deleteAll === true) {
      const result = await collection.deleteMany({});
      return Response.json(
        {
          success: true,
          message: `All ${result.deletedCount} record(s) deleted.`,
        },
        { headers: corsHeaders },
      );
    }

    return Response.json(
      { success: false, message: "Invalid payload." },
      { status: 400, headers: corsHeaders },
    );
  } catch (err) {
    return errorResponse(err, "Failed to delete errors.");
  }
}

/* ───────────────────── Error Handler ───────────────────── */

function errorResponse(err, message = "Internal server error.") {
  console.error(`[pixpro] ${message}`, err); // always log server-side
  return Response.json(
    {
      success: false,
      message,
      error: process.env.NODE_ENV === "development" ? String(err) : undefined,
    },
    { status: 500, headers: corsHeaders },
  );
}
