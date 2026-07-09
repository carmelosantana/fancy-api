import { NextResponse } from "next/server";
import { getApiBySlug, getApiStats } from "@app/core";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const database = await db();
  const api = await getApiBySlug(database, slug);
  if (!api) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stats = await getApiStats(database, api.id);
  return NextResponse.json(stats);
}
