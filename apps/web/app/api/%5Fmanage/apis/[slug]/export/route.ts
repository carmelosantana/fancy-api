import { exportApi, serializeSpec, type SerializeFormat } from "@app/core";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const url = new URL(req.url);
  const format: SerializeFormat = url.searchParams.get("format") === "json" ? "json" : "yaml";

  const database = await db();
  let spec;
  try {
    spec = await exportApi(database, slug);
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const text = serializeSpec(spec, format);
  const contentType = format === "json" ? "application/json; charset=utf-8" : "application/yaml; charset=utf-8";
  const filename = `${slug}.${format === "json" ? "json" : "yaml"}`;

  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
