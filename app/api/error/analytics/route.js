import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId"); // optional filter
    const topN = Math.min(
      parseInt(searchParams.get("top") || "50", 10) || 50,
      200,
    );

    const match = projectId ? { projectId } : {};

    const client = await clientPromise;
    const collection = client.db("errors").collection("pixpro");

    const [totalErrors, projectCounts, errorMessages] = await Promise.all([
      // Total errors (respects projectId filter if present)
      collection.countDocuments(match),

      // Count per project
      collection
        .aggregate([
          { $match: match },
          { $group: { _id: "$projectId", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $project: { _id: 0, projectId: "$_id", count: 1 } },
        ])
        .toArray(),

      // Count per unique error.message (only the message + how often + last seen)
      collection
        .aggregate([
          { $match: match },
          {
            $group: {
              _id: "$error.message",
              count: { $sum: 1 },
              lastSeen: { $max: "$timestamp" },
            },
          },
          { $sort: { count: -1 } },
          { $limit: topN },
          { $project: { _id: 0, message: "$_id", count: 1, lastSeen: 1 } },
        ])
        .toArray(),
    ]);

    return Response.json(
      {
        success: true,
        filtered: Boolean(projectId),
        totalErrors,
        projectCount: projectCounts.length,
        projectCounts,
        errorMessages,
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("[pixpro] Failed to build analytics", err);
    return Response.json(
      {
        success: false,
        message: "Failed to build analytics.",
        error: process.env.NODE_ENV === "development" ? String(err) : undefined,
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
