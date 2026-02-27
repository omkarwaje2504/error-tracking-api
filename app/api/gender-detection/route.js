import { NextResponse } from "next/server";
import * as ort from "onnxruntime-web";
import sharp from "sharp";
import path from "path";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ───────────────────── WASM CONFIG (CRITICAL) ───────────────────── */

// Disable features not supported in Vercel serverless
ort.env.wasm.simd = false;
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

// Tell ONNX where wasm files exist in node_modules
ort.env.wasm.wasmPaths = path.join(
  process.cwd(),
  "node_modules/onnxruntime-web/dist/",
);

/* ───────────────────── Model Singleton ───────────────────── */

let session = null;

async function loadModel() {
  if (!session) {
    const modelUrl = "https://pixpro-video-generation.s3.ap-south-1.amazonaws.com/gender1.onnx"

    session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ["wasm"],
    })

    console.log("Model loaded from S3")
    console.log("Inputs:", session.inputNames)
    console.log("Outputs:", session.outputNames)
  }

  return session
}

/* ───────────────────── CORS ───────────────────── */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

/* ───────────────────── POST ───────────────────── */

export async function GET() {
  const path = "Working";
  return new NextResponse(path, { status: 204, headers: corsHeaders });
}
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

    const mean = [104, 117, 123]; // BGR mean (OpenCV style)

    for (let i = 0; i < 224 * 224; i++) {
      const r = resized[i * 3];
      const g = resized[i * 3 + 1];
      const b = resized[i * 3 + 2];

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

    const rawScores = Array.from(outputTensor.data);
    const probabilities = softmax(rawScores);

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
      { error: "Processing failed", details: err.message },
      { status: 500, headers: corsHeaders },
    );
  }
}
