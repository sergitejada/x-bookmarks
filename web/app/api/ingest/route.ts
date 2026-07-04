import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { upsertTweets } from "@/lib/db";
import { ensureMediaForTweets } from "@/lib/media";

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

  // Descargar imágenes/vídeos en segundo plano, sin bloquear la respuesta
  // a la extensión. Idempotente: lo ya descargado se salta.
  const ids = tweets
    .map((t) => (t as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length > 0) {
    after(async () => {
      await ensureMediaForTweets(ids).catch(() => {});
    });
  }

  return NextResponse.json(result, { headers: CORS_HEADERS });
}
