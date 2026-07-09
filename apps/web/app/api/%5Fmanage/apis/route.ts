import { NextResponse } from "next/server";
import {
  ingest,
  getApiBySlug,
  listApis,
  listCollections,
  updateApi,
  generateToken,
  hashToken,
  parseTable,
} from "@app/core";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { RESERVED_API_SLUGS, RESERVED_COLLECTION_SLUGS } from "@/lib/reserved";

interface CreateApiBody {
  apiSlug?: unknown;
  apiName?: unknown;
  description?: unknown;
  collectionSlug?: unknown;
  collectionName?: unknown;
  rows?: unknown;
  csvText?: unknown;
  tableText?: unknown;
}

/**
 * `rows`, when supplied directly as JSON, may carry native JSON types
 * (numbers, booleans, null). The ingest pipeline's column-type inference
 * only understands the string representation of each cell (the same shape
 * `parseTable` produces for CSV/TSV), so stringify every value here to give
 * JSON-rows and pasted-table-rows identical treatment.
 */
function normalizeRows(rows: unknown): Record<string, string>[] | null {
  if (!Array.isArray(rows)) return null;
  return rows.map((row) => {
    if (typeof row !== "object" || row === null) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      out[key] = value === null || value === undefined ? "" : String(value);
    }
    return out;
  });
}

export async function GET(req: Request) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const database = await db();
  const apis = await listApis(database);
  const withCollections = await Promise.all(
    apis.map(async (api) => {
      const collections = await listCollections(database, api.id);
      const config = api.config as { readKey?: unknown };
      return {
        slug: api.slug,
        name: api.name,
        description: api.description,
        hasReadKey: Boolean(api.readKey || config?.readKey),
        hasWriteToken: Boolean(api.writeTokenHash),
        createdAt: api.createdAt,
        updatedAt: api.updatedAt,
        collections: collections.map((c) => ({
          slug: c.slug,
          name: c.name,
          schema: c.schema,
        })),
      };
    }),
  );

  return NextResponse.json({ apis: withCollections });
}

export async function POST(req: Request) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  let body: CreateApiBody;
  try {
    body = (await req.json()) as CreateApiBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiSlug = typeof body.apiSlug === "string" ? body.apiSlug.trim() : "";
  if (!apiSlug) {
    return NextResponse.json({ error: "apiSlug is required" }, { status: 400 });
  }
  if (RESERVED_API_SLUGS.has(apiSlug)) {
    return NextResponse.json({ error: `Reserved api slug: ${apiSlug}` }, { status: 400 });
  }

  const collectionSlug =
    typeof body.collectionSlug === "string" && body.collectionSlug.trim()
      ? body.collectionSlug.trim()
      : undefined;
  if (collectionSlug && RESERVED_COLLECTION_SLUGS.has(collectionSlug)) {
    return NextResponse.json(
      { error: `Reserved collection slug: ${collectionSlug}` },
      { status: 400 },
    );
  }

  let rows = normalizeRows(body.rows);
  if (!rows) {
    const text =
      typeof body.csvText === "string"
        ? body.csvText
        : typeof body.tableText === "string"
          ? body.tableText
          : null;
    if (text) rows = parseTable(text);
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { error: "Provide rows, csvText, or tableText with at least one row" },
      { status: 400 },
    );
  }

  const database = await db();
  const existedBefore = Boolean(await getApiBySlug(database, apiSlug));

  const result = await ingest(database, {
    apiSlug,
    apiName: typeof body.apiName === "string" ? body.apiName : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    collectionSlug,
    collectionName: typeof body.collectionName === "string" ? body.collectionName : undefined,
    rows,
  });

  const collections = await listCollections(database, result.apiId);
  const collection = collections.find((c) => c.id === result.collectionId);

  let writeToken: string | undefined;
  if (!existedBefore) {
    writeToken = generateToken();
    await updateApi(database, apiSlug, { writeTokenHash: hashToken(writeToken) });
  }

  return NextResponse.json({
    apiSlug,
    collectionSlug: collection?.slug ?? collectionSlug ?? "items",
    inserted: result.inserted,
    ...(writeToken ? { writeToken } : {}),
  });
}
