import { NextResponse } from "next/server";
import { getApiBySlug, deleteApi } from "@app/core";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const database = await db();
  const existing = await getApiBySlug(database, slug);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteApi(database, slug);
  return NextResponse.json({ ok: true });
}
