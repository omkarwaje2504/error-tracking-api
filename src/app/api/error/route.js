import clientPromise from "../../../../lib/mongodb";
import { ObjectId } from "mongodb";   // needed by PATCH

/* ─────────────────────────────────────────────────────────
   Shared CORS header block
───────────────────────────────────────────────────────────*/
const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ───────────────────────── OPTIONS ──────────────────────*/
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/* ───────────────────────── GET : list latest errors ─────*/
export async function GET(request) {
  try {
    const url       = new URL(request.url);
    const projectId = url.searchParams.get("projectId");

    const client = await clientPromise;
    const db     = client.db("errors");

    const query  = projectId ? { projectId } : {};
    const errors = await db
      .collection("pixpro")
      .find(query)
      .sort({ timestamp: -1 })
      .limit(100)
      .project({ screenshot: 0 })            // omit heavy screenshots
      .toArray();

    return new Response(JSON.stringify({ success: true, data: errors }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Failed to fetch errors:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Failed to fetch errors." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
}

/* ───────────────────────── POST : create one error doc ─*/
export async function POST(request) {
  try {
    const body = await request.json();

    const {
      error,           // { name, message, stack }
      mappedStack,
      deviceInfo,
      locationInfo,
      geo = {},
      screenshot = "",
      projectId = "unknown",
    } = body;

    if (!error?.message) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid payload." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const client = await clientPromise;
    const db     = client.db("errors");

    await db.collection("pixpro").insertOne({
      projectId,
      error,
      mappedStack,
      deviceInfo,
      locationInfo,
      geo,
      screenshot,      // store inline (limit in front-end if large)
      timestamp: new Date(),
      status: "pending",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Logged successfully." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err) {
    console.error("Failed to log error:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Failed to log error." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
}

/* ───────────────────────── PATCH : update status ────────
   Called from front-end with:
   fetch(`/api/error/${id}`, { method:"PATCH", body:JSON.stringify({status:"resolved"}) })
──────────────────────────────────────────────────────────*/
export async function PATCH(request, { params }) {
  try {
    const { id }  = params;                 // route is /api/error/[id]
    const { status } = await request.json(); // resolved | rejected | pending

    if (!["resolved", "rejected", "pending"].includes(status))
      throw new Error("Invalid status");

    const client = await clientPromise;
    await client
      .db("errors")
      .collection("pixpro")
      .updateOne({ _id: new ObjectId(id) }, { $set: { status } });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err) {
    console.error("Failed to update status:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Failed to update status." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
}
