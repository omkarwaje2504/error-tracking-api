import { NextResponse } from "next/server";
import * as ort from "onnxruntime-node";
import sharp from "sharp";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ───────────────────── Model Singleton ───────────────────── */

let session = null;

async function loadModel() {
  if (!session) {
    session = await ort.InferenceSession.create(
      `${process.cwd()}/models/gender1.onnx`,
    );

    console.log("Model loaded");
    console.log("Inputs:", session.inputNames);
    console.log("Outputs:", session.outputNames);
  }

  return session;
}

/* ───────────────────── CORS ───────────────────── */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ───────────────────── OPTIONS ───────────────────── */

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/* ───────────────────── Softmax ───────────────────── */

function softmax(arr) {
  const max = Math.max(...arr);
  const exps = arr.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    return Response.json(
      {
        success: true,
       
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    return errorResponse(err, "Failed to fetch errors.");
  }
}
/* ───────────────────── POST ───────────────────── */

export async function POST(req) {
  try {
    /* ───────── Log API Call ───────── */

    const user_platform = req.headers.get("sec-ch-ua-platform");
    const user_url = req.headers.get("origin");

    const client = await clientPromise;

    await client.db("apicalls").collection("analysis").insertOne({
      user_platform,
      user_url,
      type: "gender",
      timestamp: new Date(),
    });

    /* ───────── Load Model ───────── */

    const model = await loadModel();

    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image URL provided" },
        { status: 400, headers: corsHeaders },
      );
    }

    /* ───────── Fetch Image ───────── */

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error("Failed to fetch image");
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    /* ───────── Preprocess Image ───────── */

    const resized = await sharp(buffer)
      .resize(224, 224)
      .removeAlpha()
      .raw()
      .toBuffer();

    const floatData = new Float32Array(1 * 3 * 224 * 224);

    const mean = [104, 117, 123]; // OpenCV BGR mean

    for (let i = 0; i < 224 * 224; i++) {
      const r = resized[i * 3];
      const g = resized[i * 3 + 1];
      const b = resized[i * 3 + 2];

      // BGR order + mean subtraction
      floatData[i] = b - mean[0];
      floatData[i + 224 * 224] = g - mean[1];
      floatData[i + 2 * 224 * 224] = r - mean[2];
    }

    const inputTensor = new ort.Tensor("float32", floatData, [1, 3, 224, 224]);

    const feeds = {};
    feeds[model.inputNames[0]] = inputTensor;

    /* ───────── Run Inference ───────── */

    const results = await model.run(feeds);

    const outputTensor = results[model.outputNames[0]];
    if (!outputTensor) {
      throw new Error("Model output missing");
    }

    const rawScores = outputTensor.data;

    // Convert logits to probabilities
    const probabilities = softmax(Array.from(rawScores));

    const femaleScore = probabilities[0];
    const maleScore = probabilities[1];

    const gender = maleScore > femaleScore ? "Male" : "Female";
    const confidence = Math.max(femaleScore, maleScore);

    return NextResponse.json(
      {
        gender,
        confidence,
        probabilities: {
          female: femaleScore,
          male: maleScore,
        },
        raw: {
          female: rawScores[0],
          male: rawScores[1],
        },
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("Error processing image:", err);

    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500, headers: corsHeaders },
    );
  }
}
