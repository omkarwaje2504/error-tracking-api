

/* ───────────────────── Shared CORS ───────────────────── */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ───────────────────── OPTIONS ───────────────────── */
async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async fucntion POST(request){
  
const body=await request.json();

if(!body.employee_hash || !body.hash){
 return new Response(
      JSON.stringify({ success: false, message: "Give the data first" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
}


  const fetchData = await fetch(
          `https://pixpro.app/api/employee/${body.employee_hash}/contact/${body.hash}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              id: hash,
            }),
          },
        );
        const result = await response.json();

  
  

   return new Response(
      JSON.stringify({ success: true, message:result }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );


}
