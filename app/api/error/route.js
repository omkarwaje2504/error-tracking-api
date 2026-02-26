import { SourceMapConsumer } from "source-map-js";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { fromError } from "stacktrace-js";

/* ───────────────────── Route Config (Next.js 16) ───────────────────── */

export const runtime = "nodejs"; // Required (mongodb + source-map)
export const dynamic = "force-dynamic"; // Prevent static optimization

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

function errorFromString(stackString = "") {
  const [firstLine = "Error", ...rest] = stackString.split("\n");

  let name = "Error";
  let message = firstLine;

  const colon = firstLine.indexOf(":");
  if (colon !== -1) {
    name = firstLine.slice(0, colon).trim() || "Error";
    message = firstLine.slice(colon + 1).trim();
  }

  const err = new Error(message);
  err.name = name;
  err.stack = [firstLine, ...rest].join("\n");
  return err;
}

async function fetchSnippet(url, line) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const text = await res.text();
    const lines = text.split("\n");

    const ctx = 5;
    const start = Math.max(0, line - ctx - 1);
    const end = Math.min(lines.length, line + ctx);

    return lines
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

/* ───────────────────── Source Map Resolver ───────────────────── */

async function mapStackTrace(minifiedStack) {
  if (!minifiedStack) return [];

  const errObj = errorFromString(minifiedStack);
  const frames = await fromError(errObj);
  const out = [];

  for (const f of frames) {
    if (!f.fileName) continue;

    try {
      const mapURL = `${f.fileName}.map`;
      const resp = await fetch(mapURL, { cache: "no-store" });
      if (!resp.ok) continue;

      const rawMap = await resp.text();
      const consumer = await new SourceMapConsumer(rawMap);

      const pos = consumer.originalPositionFor({
        line: f.lineNumber,
        column: f.columnNumber,
      });

      if (!pos.source || !pos.line) {
        consumer.destroy();
        continue;
      }

      let sourceText = consumer.sourceContentFor(pos.source, true);

      if (!sourceText) {
        const absUrl = new URL(pos.source, mapURL).href;
        sourceText = await fetchSnippet(absUrl, pos.line);
      }

      if (sourceText) {
        if (out.length) out.push({ separator: true });

        out.push({
          function: f.functionName,
          source: pos.source,
          line: pos.line,
          column: pos.column,
          snippet: sourceText.includes("────")
            ? sourceText
            : `──────── ${pos.source} ────────\n${sourceText}`,
        });
      }

      consumer.destroy(); // 🔥 prevent memory leak
    } catch {
      continue;
    }
  }

  return out;
}

/* ───────────────────── Reverse Geocode ───────────────────── */

async function reverseGeocode(lat, lon) {
  if (!lat || !lon) return {};

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "pixpro-error-tracker/1.0",
      },
    });

    if (!res.ok) return {};

    const { address = {} } = await res.json();

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
    return {}; // 🔥 fixed (previously returned Response)
  }
}

/* ───────────────────── GET ───────────────────── */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const client = await clientPromise;
    const db = client.db("errors");

    const query = projectId ? { projectId } : {};

    const errors = await db
      .collection("pixpro")
      .find(query)
      .sort({ timestamp: -1 })
      .limit(100)
      .project({ screenshot: 0 })
      .toArray();

    return Response.json(
      {
        success: true,
        filtered: Boolean(projectId),
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
    const body = await request.json();

    if (!body?.error?.message) {
      return Response.json(
        { success: false, message: "Invalid payload." },
        { status: 400, headers: corsHeaders },
      );
    }

    const mappedStack = await mapStackTrace(body.error.stack);

    const geo = body.geo || {};
    const location = await reverseGeocode(geo.lat, geo.lon);

    const client = await clientPromise;

    await client
      .db("errors")
      .collection("pixpro")
      .insertOne({
        projectId: body.projectId || "unknown",
        error: body.error,
        mappedStack,
        deviceInfo: body.deviceInfo,
        locationInfo: body.locationInfo,
        geo,
        ...location,
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
    const body = await request.json();
    const client = await clientPromise;
    const collection = client.db("errors").collection("pixpro");

    if (body.id && ObjectId.isValid(body.id)) {
      const result = await collection.deleteOne({
        _id: new ObjectId(body.id),
      });

      return Response.json(
        {
          success: result.deletedCount > 0,
          message:
            result.deletedCount > 0 ? "Record deleted." : "Record not found.",
        },
        { headers: corsHeaders },
      );
    }

    if (Array.isArray(body.ids)) {
      const objectIds = body.ids
        .filter(ObjectId.isValid)
        .map((id) => new ObjectId(id));

      const result = await collection.deleteMany({
        _id: { $in: objectIds },
      });

      return Response.json(
        {
          success: true,
          message: `Deleted ${result.deletedCount} record(s).`,
        },
        { headers: corsHeaders },
      );
    }

    if (body.projectId) {
      const result = await collection.deleteMany({
        projectId: body.projectId,
      });

      return Response.json(
        {
          success: true,
          message: `Deleted ${result.deletedCount} record(s).`,
        },
        { headers: corsHeaders },
      );
    }

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
  return Response.json(
    {
      success: false,
      message,
      error: process.env.NODE_ENV === "development" ? String(err) : undefined,
    },
    { status: 500, headers: corsHeaders },
  );
}
