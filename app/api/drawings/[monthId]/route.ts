import {
  getDrawingKey,
  getDrawingsBucket,
  isAllowedMonthId,
  isSupportedImage,
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_LENGTH,
  normalizeMessage,
  verifyUploadCode,
} from "@/lib/drawings-storage";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ monthId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { monthId } = await context.params;
  if (!isAllowedMonthId(monthId)) {
    return new Response("Lună invalidă.", { status: 400 });
  }

  try {
    const object = await getDrawingsBucket().get(getDrawingKey(monthId));
    if (!object) return new Response("Desenul nu există.", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata?.(headers);
    headers.set("Content-Type", object.httpMetadata?.contentType ?? "image/webp");
    headers.set("Cache-Control", "public, max-age=300, must-revalidate");
    headers.set("ETag", object.httpEtag ?? `"${object.etag}"`);
    headers.set("X-Content-Type-Options", "nosniff");

    if (request.headers.get("If-None-Match") === headers.get("ETag")) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(object.body, { headers });
  } catch {
    return new Response("Stocarea desenelor nu este disponibilă momentan.", {
      status: 503,
    });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { monthId } = await context.params;
  if (!isAllowedMonthId(monthId)) {
    return Response.json({ error: "Luna selectată nu poate fi modificată." }, { status: 400 });
  }

  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return Response.json({ error: "Cerere refuzată." }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const image = form.get("image");
    const message = normalizeMessage(String(form.get("message") ?? ""));
    const code = String(form.get("code") ?? "");

    if (!(await verifyUploadCode(code))) {
      return Response.json({ error: "Codul de publicare este greșit." }, { status: 401 });
    }

    if (!(image instanceof File)) {
      return Response.json({ error: "Imaginea lipsește." }, { status: 400 });
    }
    if (image.size <= 0 || image.size > MAX_IMAGE_BYTES) {
      return Response.json(
        { error: "Imaginea trebuie să aibă cel mult 4 MB." },
        { status: 413 },
      );
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return Response.json(
        { error: `Mesajul poate avea cel mult ${MAX_MESSAGE_LENGTH} de caractere.` },
        { status: 400 },
      );
    }

    const imageBuffer = await image.arrayBuffer();
    const bytes = new Uint8Array(imageBuffer);
    if (!isSupportedImage(bytes, image.type)) {
      return Response.json(
        { error: "Imaginea trebuie să fie WebP sau PNG valid." },
        { status: 415 },
      );
    }

    const stored = await getDrawingsBucket().put(getDrawingKey(monthId), imageBuffer, {
      httpMetadata: {
        contentType: image.type,
        cacheControl: "public, max-age=300, must-revalidate",
      },
      customMetadata: { message },
    });

    return Response.json(
      {
        drawing: {
          imageUrl: `/api/drawings/${monthId}?v=${encodeURIComponent(stored.etag)}`,
          message,
          updatedAt: stored.uploaded.toISOString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Desenul nu a putut fi salvat. Încearcă din nou." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
