import clientPromise from "../../../../lib/mongodb";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// ---------- GET : latest 100 errors (optionally filter by ?projectId=xxx) ----------
export async function GET(request) {
  try {
    const url       = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    const client    = await clientPromise;
    const db        = client.db("errors");

    const query  = projectId ? { projectId } : {};
    const errors = await db.collection("pixpro")
      .find(query)                        // newest first
      .sort({ timestamp: -1 })
      .limit(100)
      .project({ screenshot: 0 })         // 🚫 omit large Base64 unless needed
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

// ---------- POST: save one error report ----------
export async function POST(request) {
  try {
    const body = await request.json();

    /* --------- 1. Required & optional fields --------- */
    const {
      error,           // { name, message, stack }
      mappedStack,     // array from source-map lookup
      deviceInfo,      // { browser, os, device, screen, userAgent }
      locationInfo,    // { url, referrer }
      geo = {},        // { lat, lon, accuracy }  (may be {})
      screenshot = "", // data:image/png;base64,…  (OPTIONAL / can be huge)
      projectId = "unknown",
    } = body;

    if (!error?.message) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid payload." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    /* --------- 2. Persist --------- */
    const client = await clientPromise;
    const db     = client.db("errors");

    await db.collection("pixpro").insertOne({
      projectId,
      error,
      mappedStack,
      deviceInfo,
      locationInfo,
      geo,
      screenshot,          // 💾 store inline *only* if size ≤ 2 MB
      timestamp: new Date(),
      status: "pending",   // triage flag
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
