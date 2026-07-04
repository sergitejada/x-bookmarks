import { NextRequest, NextResponse } from "next/server";
import { upsertTweets } from "@/lib/db";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "JSON inválido" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const tweets = (body as { tweets?: unknown[] })?.tweets;
  if (!Array.isArray(tweets)) {
    return NextResponse.json(
      { error: "Se espera { tweets: [...] }" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const result = upsertTweets(tweets);
  return NextResponse.json(result, { headers: CORS_HEADERS });
}
