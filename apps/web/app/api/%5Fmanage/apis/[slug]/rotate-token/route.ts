import { NextResponse } from "next/server";
import { getApiBySlug, updateApi, generateToken, hashToken } from "@app/core";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const database = await db();
  const existing = await getApiBySlug(database, slug);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const writeToken = generateToken();
  await updateApi(database, slug, { writeTokenHash: hashToken(writeToken) });

  return NextResponse.json({ apiSlug: slug, writeToken });
}
