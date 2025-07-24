import { renderMediaOnLambda } from "@remotion/lambda/client";

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

export async function POST(request) {
  try {
    const body = await request.json();
    const { employee_hash, hash } = body;

    const { renderId, bucketName, folderInS3Console } =
      await renderMediaOnLambda({
        region: "ap-south-1",
        functionName: "remotion-render-4-0-248-mem2048mb-disk1024mb-600sec",
        serveUrl:
          "https://remotionlambda-apsouth1-m61gk15thb.s3.ap-south-1.amazonaws.com/sites/pixpro-prop-motion/index.html",
        composition: "RPGBioVideo",
        codec: "h264",
        imageFormat: "jpeg",
        inputProps: { employee_hash, hash },
        downloadBehavior: {
          type: "play-in-browser",
        },
        deleteAfter: "1-day",
      });
    const url = `${folderInS3Console}/out.mp4`;
    return new Response(
      JSON.stringify({
        renderId,
        bucketName,
        url,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      { status: 500 }
    );
  }
}
