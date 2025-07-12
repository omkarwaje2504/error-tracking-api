import { SourceMapConsumer } from "source-map-js";
import clientPromise from "../../../../lib/mongodb";
import { ObjectId } from "mongodb";
import { fromError } from "stacktrace-js";
import { URL } from "url";

/* ───────────────────── Shared CORS ───────────────────── */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ───────────────────── Helper: build Error ───────────────────── */
export function errorFromString(stackString) {
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
    console.warn("Reverse geocoding failed:", err);
    return {};
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

    // build query: all docs if no projectId, else filter
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
        filtered: Boolean(projectId), // helpful flag for the frontend
        count: errors.length,
        data: errors,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (err) {
    console.error("Failed to fetch errors:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Failed to fetch errors." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}

/* ───────────────────── POST ─────────────────────
   • Insert a new log  → body: { error, deviceInfo, ... }
   • Update status     → body: { id, status }
────────────────────────────────────────────────────── */
export async function POST(request) {
  try {
    const body = await request.json();

    /* ---------- 1️⃣  status update ---------- */
    if (body.id && body.status) {
      if (!["resolved", "rejected", "pending"].includes(body.status)) {
        throw new Error("Invalid status");
      }

      const client = await clientPromise;

      await client
        .db("errors")
        .collection("pixpro")
        .updateOne(
          { _id: ObjectId.createFromHexString(body.id) },
          { $set: { status: body.status } }
        );

      return new Response(
        JSON.stringify({ success: true, message: "Status updated." }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    /* ---------- 2️⃣  create-log ---------- */
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
      status: "pending",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Logged with source map." }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (err) {
    console.error("Failed to process POST:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
