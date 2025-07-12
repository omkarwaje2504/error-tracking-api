import { SourceMapConsumer } from "source-map-js";
import clientPromise from "../../../../lib/mongodb";
import { ObjectId } from "mongodb";
import { fromError } from "stacktrace-js";

/* ─────────────── Shared CORS ─────────────── */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ─────── Helpers ─────── */
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

async function fetchSnippet(srcUrl, line, context = 5) {
  const resp = await fetch(srcUrl, { cache: "no-store" });
  if (!resp.ok) return null;
  const text = await resp.text();
  const lines = text.split("\n");
  const start = Math.max(0, line - context - 1);
  const end = Math.min(lines.length, line + context);
  return lines
    .slice(start, end)
    .map((l, idx) => {
      const ln = start + idx + 1;
      return ln === line
        ? `>> ${ln.toString().padStart(4)} | ${l}`
        : `   ${ln.toString().padStart(4)} | ${l}`;
    })
    .join("\n");
}

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
      const absSourceURL = new URL(pos.source, mapURL).href;
      const snippet = await fetchSnippet(absSourceURL, pos.line);
      out.push({
        function: f.functionName,
        ...pos,
        snippet, // ±5 lines with highlight
      });
    }
    consumer.destroy();
  }
  return out;
}

/* ───────── OPTIONS ───────── */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/* ───────── GET ───────── */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");

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

    return new Response(JSON.stringify({ success: true, data: errors }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
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

/* ───────── POST ─────────
   • Insert a new log  → body: { error, deviceInfo, ... }
   • Update status     → body: { id, status }
────────────────────────── */
export async function POST(request) {
  try {
    const body = await request.json();

    /* ---------- 1️⃣  status update path ---------- */
    if (body.id && body.status) {
      if (!["resolved", "rejected", "pending"].includes(body.status))
        throw new Error("Invalid status");

      const client = await clientPromise;
      await client
        .db("errors")
        .collection("pixpro")
        .updateOne(
          { _id: new ObjectId(body.id) },
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

    /* ---------- 2️⃣  create-log path ---------- */
    const {
      error, // { name, message, stack }
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

    const mappedStack = await mapStackTrace(error.stack);

    const client = await clientPromise;
    await client.db("errors").collection("pixpro").insertOne({
      projectId,
      error,
      mappedStack,
      deviceInfo,
      locationInfo,
      geo,
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
