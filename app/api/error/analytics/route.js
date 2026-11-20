import { query, queryOne } from "@/lib/db";

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
      1000,
    );

    const filter = projectId ? `WHERE "projectId" = $1` : "";
    const filterParams = projectId ? [projectId] : [];

    const [totalRow, projectCounts, errorMessages] = await Promise.all([
      // Total errors (respects projectId filter if present)
      queryOne(`SELECT count(*)::int AS n FROM error_logs ${filter}`, filterParams),

      // Count per project
      query(
        `SELECT "projectId", count(*)::int AS "count" FROM error_logs ${filter}
         GROUP BY "projectId" ORDER BY "count" DESC`,
        filterParams,
      ),

      // Count per unique error.message (only the message + how often + last seen)
      query(
        `SELECT "error"->>'message' AS "message", count(*)::int AS "count", max("timestamp") AS "lastSeen"
         FROM error_logs ${filter}
         GROUP BY "error"->>'message' ORDER BY "count" DESC
         LIMIT $${filterParams.length + 1}`,
        [...filterParams, topN],
      ),
    ]);
    const totalErrors = totalRow.n;

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
