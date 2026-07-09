import { listCollections, type ColumnSchema } from "@app/core";
import { db } from "@/lib/db";
import { corsOptionsResponse, jsonWithCors, resolveApi } from "@/lib/publicApi";

export async function OPTIONS() {
  return corsOptionsResponse();
}

function paramSchema(type: ColumnSchema["type"]): { type: string; format?: string } {
  switch (type) {
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "date":
      return { type: "string", format: "date-time" };
    default:
      return { type: "string" };
  }
}

function filterParams(schema: ColumnSchema[]) {
  return schema.flatMap((col) => {
    const base = paramSchema(col.type);
    const suffixes = col.type === "string" ? ["", "_ne", "_contains", "_in"] : ["", "_ne", "_gt", "_gte", "_lt", "_lte", "_in"];
    return suffixes.map((suffix) => ({
      name: `${col.name}${suffix}`,
      in: "query",
      required: false,
      schema: base,
      description: suffix ? `Filter: ${col.name} ${suffix.slice(1)}` : `Filter: ${col.name} equals`,
    }));
  });
}

const recordSchema = { type: "object", additionalProperties: true } as const;

export async function GET(req: Request, { params }: { params: Promise<{ api: string }> }) {
  const { api: apiSlug } = await params;
  const database = await db();
  const api = await resolveApi(database, apiSlug);
  if (!api) {
    return jsonWithCors({ error: "Api not found" }, { status: 404 });
  }

  const collections = await listCollections(database, api.id);
  const url = new URL(req.url);
  const serverUrl = `${url.protocol}//${url.host}/api/${api.slug}`;

  const paths: Record<string, unknown> = {};
  for (const collection of collections) {
    paths[`/${collection.slug}`] = {
      get: {
        summary: `List ${collection.name}`,
        operationId: `list_${collection.slug}`,
        parameters: [
          ...filterParams(collection.schema),
          {
            name: "sort",
            in: "query",
            schema: { type: "string" },
            description: "Comma-separated field names; prefix a field with - for descending order.",
          },
          { name: "limit", in: "query", schema: { type: "integer", default: 25, maximum: 100, minimum: 1 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0, minimum: 0 } },
          { name: "q", in: "query", schema: { type: "string" }, description: "Free-text search across string fields." },
        ],
        responses: {
          "200": {
            description: "A page of records",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: recordSchema },
                    meta: {
                      type: "object",
                      properties: {
                        total: { type: "integer" },
                        limit: { type: "integer" },
                        offset: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    paths[`/${collection.slug}/random`] = {
      get: {
        summary: `Get a random ${collection.name} record`,
        operationId: `random_${collection.slug}`,
        responses: {
          "200": {
            description: "A single random record",
            content: { "application/json": { schema: { type: "object", properties: { data: recordSchema } } } },
          },
          "404": { description: "Collection is empty" },
        },
      },
    };

    paths[`/${collection.slug}/{id}`] = {
      get: {
        summary: `Get a ${collection.name} record by id`,
        operationId: `get_${collection.slug}_by_id`,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          "200": {
            description: "A single record",
            content: { "application/json": { schema: { type: "object", properties: { data: recordSchema } } } },
          },
          "404": { description: "Record not found" },
        },
      },
    };
  }

  const doc = {
    openapi: "3.1.0",
    info: {
      title: api.name,
      description: api.description ?? undefined,
      version: "1.0.0",
    },
    servers: [{ url: serverUrl }],
    paths,
  };

  return jsonWithCors(doc);
}
