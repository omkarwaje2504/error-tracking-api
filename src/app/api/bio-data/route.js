/* ───────────────────── Shared CORS ───────────────────── */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ───────────────────── OPTIONS ───────────────────── */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

function getCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/* ───────────────────── POST ───────────────────── */
export async function POST(request) {
   const origin = request.headers.get("origin") || "*";
  const headers = getCorsHeaders(origin);

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers }
  );
  
  // const body = await request.json();

  // if (!body.employee_hash || !body.hash) {
  //   return new Response(
  //     JSON.stringify({ success: false, message: "Give the data first" }),
  //     {
  //       status: 200,
  //       headers: { "Content-Type": "application/json", ...corsHeaders },
  //     }
  //   );
  // }

  // try {
  //   const response = await fetch(
  //     `https://pixpro.app/api/employee/${body.employee_hash}/contact/${body.hash}`,
  //     {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Accept: "application/json",
  //       },
  //       body: JSON.stringify({ id: body.hash }),
  //     }
  //   );

  //   const result = await response.json();

  //   return new Response(
  //     JSON.stringify({ success: true, message: result }),
  //     {
  //       status: 200,
  //       headers: { "Content-Type": "application/json", ...corsHeaders },
  //     }
  //   );
  // } catch (error) {
  //   return new Response(
  //     JSON.stringify({ success: false, message: "Request failed", error: error.message }),
  //     {
  //       status: 500,
  //       headers: { "Content-Type": "application/json", ...corsHeaders },
  //     }
  //   );
  // }
}
