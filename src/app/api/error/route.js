import { SourceMapConsumer } from "source-map-js";
import clientPromise from "../../../../lib/mongodb";
import { ObjectId } from "mongodb";
import { fromError } from "stacktrace-js";
import { URL } from "url";

/* ───────────────────── Shared CORS ───────────────────── */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ───────────────────── Helper: build Error ───────────────────── */
function errorFromString(stackString) {
  const [firstLine, ...rest] = stackString.split("\n");

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

/* ───────────────────── Helper: fetch ± lines of a source file ───────────────────── */
async function mapStackTrace(minifiedStack) {
  const errObj = errorFromString(minifiedStack);
  const frames = await fromError(errObj);
  const out = [];

  for (const f of frames) {
    if (!f.fileName) continue;

    const mapURL = `${f.fileName}.map`;
    const resp = await fetch(mapURL, { cache: "no-store" });
    if (!resp.ok) continue;

    const rawMap = await resp.text();
    const consumer = await new SourceMapConsumer(rawMap);

    const pos = consumer.originalPositionFor({
      line: f.lineNumber,
      column: f.columnNumber,
    });

    if (pos.source && pos.line) {
      // 1️⃣ inline source
      let sourceText = consumer.sourceContentFor(pos.source, true);

      // 2️⃣ fallback: http(s) fetch
      if (!sourceText) {
        const absUrl = new URL(pos.source, mapURL).href;
        sourceText = await fetchSnippet(absUrl, pos.line); // returns the ±5 lines directly
        if (sourceText) {
          // fetchSnippet already returns formatted snippet
          if (out.length) out.push({ separator: true });
          out.push({
            function: f.functionName,
            ...pos,
            snippet: `──────── ${pos.source} ────────\n${sourceText}`,
          });
          continue;
        }
      }

      // Build snippet from inlined `sourceText`
      if (sourceText) {
        const lines = sourceText.split("\n");
        const ctx = 5;
        const start = Math.max(0, pos.line - ctx - 1);
        const end = Math.min(lines.length, pos.line + ctx);
        const body = lines
          .slice(start, end)
          .map((l, idx) => {
            const ln = start + idx + 1;
            return ln === pos.line
              ? `>> ${ln.toString().padStart(4)} | ${l}`
              : `   ${ln.toString().padStart(4)} | ${l}`;
          })
          .join("\n");

        if (out.length) out.push({ separator: true });
        out.push({
          function: f.functionName,
          ...pos,
          snippet: `──────── ${pos.source} ────────\n${body}`,
        });
      }
    }
  }

  return out;
}

/* ───────────────────── Helper: reverse-geocode lat/lon → city/state ───────────────────── */
async function reverseGeocode(latitude, longitude) {
  if (latitude == null || longitude == null) return {};

  try {
    const nominatim = new URL("https://nominatim.openstreetmap.org/reverse");
    nominatim.searchParams.set("lat", latitude);
    nominatim.searchParams.set("lon", longitude);
    nominatim.searchParams.set("format", "json");

    const res = await fetch(nominatim.toString(), {
      headers: {
        "User-Agent":
          "pixpro-error-tracker/1.0 (bigviz-frontend.projectcampaign.online)",
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
  } catch (err) {
    return errorResponse(err, "Failed to fetch location.");
  }
}

/* ───────────────────── OPTIONS ───────────────────── */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/* ───────────────────── GET ───────────────────── */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId")?.trim() || null;
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

    return new Response(
      JSON.stringify({
        success: true,
        filtered: Boolean(projectId),
        count: errors.length,
        data: errors,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (err) {
    return errorResponse(err, "Failed to fetch errors.");
  }
}

/* ───────────────────── POST ─────────────────────
   • Insert a new log  → body: { error, deviceInfo, ... }
──────────────────────────────────────────────────── */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      error,
      deviceInfo,
      locationInfo,
      geo = {},
      projectId = "unknown",
    } = body;

    if (!error?.message) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid payload." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // map stack
    const mappedStack = await mapStackTrace(error.stack);
    // reverse-geocode
    const {
      city = null,
      state = null,
      country = null,
    } = await reverseGeocode(geo.lat, geo.lon);

    const client = await clientPromise;

    await client.db("errors").collection("pixpro").insertOne({
      projectId,
      error,
      mappedStack,
      deviceInfo,
      locationInfo,
      geo,
      city,
      state,
      country,
      timestamp: new Date(),
    });

    return new Response(
      JSON.stringify({ success: true, message: "Logged with source map." }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (err) {
    return errorResponse(err, "Failed to log error.");
  }
}

/* ───────────────────── DELETE ─────────────────────
   • Delete single by error ID: { id }
   • Bulk delete by IDs: { ids: [id1, id2, ...] }
   • Bulk delete by projectId: { projectId }
   • Complete delete: { deleteAll: true }
──────────────────────────────────────────────────── */
export async function DELETE(request) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db("errors");
    const collection = db.collection("pixpro");

    // 1️⃣ Delete single by ID
    if (body.id) {
      const result = await collection.deleteOne({
        _id: ObjectId.createFromHexString(body.id),
      });
      if (result.deletedCount === 0) {
        return new Response(
          JSON.stringify({ success: false, message: "Record not found." }),
          {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
      return new Response(
        JSON.stringify({ success: true, message: "Record deleted." }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 2️⃣ Bulk delete by IDs
    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const objectIds = body.ids.map((id) => ObjectId.createFromHexString(id));
      const result = await collection.deleteMany({ _id: { $in: objectIds } });
      return new Response(
        JSON.stringify({
          success: true,
          message: `Deleted ${result.deletedCount} record(s).`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 3️⃣ Bulk delete by project group
    if (body.projectId) {
      const result = await collection.deleteMany({ projectId: body.projectId });
      return new Response(
        JSON.stringify({
          success: true,
          message: `Deleted ${result.deletedCount} record(s) for project '${body.projectId}'.`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 4️⃣ Delete all records
    if (body.deleteAll === true) {
      const result = await collection.deleteMany({});
      return new Response(
        JSON.stringify({
          success: true,
          message: `All ${result.deletedCount} record(s) deleted.`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Invalid body
    return new Response(
      JSON.stringify({ success: false, message: "Invalid payload." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (err) {
    return errorResponse(err, "Failed to delete errors.");
  }
}

function errorResponse(err, message = "Internal server error.", status = 500) {
  return new Response(
    JSON.stringify({
      success: false,
      message,
      error: process.env.NODE_ENV === "development" ? String(err) : undefined,
    }),
    {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
}
