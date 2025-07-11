import { SourceMapConsumer } from "source-map";
import StackTrace from "stacktrace-js";
import fs from "fs";
import path from "path";
import clientPromise from "../../../../lib/mongodb";
import { ObjectId } from "mongodb"; // needed by PATCH

/* ─────────────────────────────────────────────────────────
   Shared CORS header block
───────────────────────────────────────────────────────────*/
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ───────────────────────────────────────────────
   Map minified stack trace to original source
──────────────────────────────────────────────── */
async function mapStackTrace(minifiedStack) {
  const frames = await StackTrace.fromString(minifiedStack);
  const out = [];

  for (const f of frames) {
    if (!f.fileName) continue;
    const mapURL = `${f.fileName}.map`;

    const resp = await fetch(mapURL, { cache: "force-cache" });
    if (!resp.ok) continue;

    const rawMap = await resp.text();
    const consumer = await new SourceMapConsumer(rawMap);

    const pos = consumer.originalPositionFor({
      line: f.lineNumber,
      column: f.columnNumber,
    });
    consumer.destroy();

    if (pos.source) {
      out.push({ function: f.functionName, ...pos });
    }
  }
  return out;
}
/* ───────────────────────── OPTIONS ──────────────────────*/
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/* ───────────────────────── GET : list latest errors ─────*/
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
      .project({ screenshot: 0 }) // omit heavy screenshots
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

/* ───────────────────────── POST : create one error doc ─*/
export async function POST(request) {
  try {
    const {
      error, // { name, message, stack }
      deviceInfo,
      locationInfo,
      geo = {},
      screenshot = "",
      projectId = "unknown",
    } = await request.json();

    if (!error?.message) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid payload." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
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
      screenshot,
      timestamp: new Date(),
      status: "pending",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Logged with source map." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Failed to log error:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/* ───────────────────────── PATCH : update status ────────
   Called from front-end with:
   fetch(`/api/error/${id}`, { method:"PATCH", body:JSON.stringify({status:"resolved"}) })
──────────────────────────────────────────────────────────*/
export async function PATCH(request, { params }) {
  try {
    const { id } = params; // route is /api/error/[id]
    const { status } = await request.json(); // resolved | rejected | pending

    if (!["resolved", "rejected", "pending"].includes(status))
      throw new Error("Invalid status");

    const client = await clientPromise;
    await client
      .db("errors")
      .collection("pixpro")
      .updateOne({ _id: new ObjectId(id) }, { $set: { status } });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Failed to update status:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Failed to update status." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
