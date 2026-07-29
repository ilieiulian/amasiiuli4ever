import {
  DRAWINGS_PREFIX,
  getDrawingsBucket,
} from "@/lib/drawings-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bucket = getDrawingsBucket();
    const drawings: Record<
      string,
      { imageUrl: string; message: string; updatedAt: string }
    > = {};
    let cursor: string | undefined;

    do {
      const page = await bucket.list({
        prefix: DRAWINGS_PREFIX,
        cursor,
        include: ["customMetadata"],
      });

      for (const object of page.objects) {
        const monthId = object.key.slice(DRAWINGS_PREFIX.length);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthId)) continue;
        drawings[monthId] = {
          imageUrl: `/api/drawings/${monthId}?v=${encodeURIComponent(object.etag)}`,
          message: object.customMetadata?.message ?? "",
          updatedAt: object.uploaded.toISOString(),
        };
      }

      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);

    return Response.json(
      { drawings },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Stocarea desenelor nu este disponibilă momentan." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
