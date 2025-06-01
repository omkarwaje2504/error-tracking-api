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

export async function POST(request) {
  try {
    const { error, projectId } = await request.json();
    const client = await clientPromise;
    const db = client.db("errors");

    const headers = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const userAgent = headers["user-agent"];

    await db.collection("pixpro").insertOne({
      error,
      projectId,
      userAgent,
      timestamp: new Date(),
      status:'pending'
    });

    return new Response(
      JSON.stringify({ message: "Error received and logged successfully." }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (e) {
    console.error("Failed to log error:", e);
    return new Response(JSON.stringify({ message: "Failed to log error." }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
