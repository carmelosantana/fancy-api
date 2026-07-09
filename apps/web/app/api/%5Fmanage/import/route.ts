import { NextResponse } from "next/server";
import { parseSpec, importApi } from "@app/core";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { RESERVED_API_SLUGS } from "@/lib/reserved";

/**
 * Body is the raw spec document text (YAML, or JSON — JSON is valid YAML so
 * `parseSpec` handles both) rather than a JSON envelope, since the whole
 * point is round-tripping whatever `export` produced byte-for-byte.
 */
export async function POST(req: Request) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const text = await req.text();
  if (!text.trim()) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  let spec;
  try {
    spec = parseSpec(text);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  if (RESERVED_API_SLUGS.has(spec.slug)) {
    return NextResponse.json({ error: `Reserved api slug: ${spec.slug}` }, { status: 400 });
  }

  const database = await db();
  try {
    const result = await importApi(database, spec, { overwrite: true });
    return NextResponse.json({ ok: true, apiId: result.apiId, apiSlug: spec.slug });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
