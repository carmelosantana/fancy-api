import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";
import type { ApiSpec } from "./types";

const columnTypeSchema = z.enum(["string", "number", "boolean", "date"]);

const columnSchemaSchema = z.object({
  name: z.string(),
  type: columnTypeSchema,
});

const collectionSpecSchema = z.object({
  slug: z.string(),
  name: z.string(),
  schema: z.array(columnSchemaSchema),
  records: z.array(z.record(z.string(), z.unknown())),
});

const apiSpecSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  collections: z.array(collectionSpecSchema),
});

export type SerializeFormat = "yaml" | "json";

/**
 * Serializes an ApiSpec to YAML (default) or pretty JSON text.
 */
export function serializeSpec(spec: ApiSpec, format: SerializeFormat = "yaml"): string {
  if (format === "json") {
    return JSON.stringify(spec, null, 2);
  }
  return stringifyYaml(spec);
}

/**
 * Parses text (YAML or JSON, since JSON is valid YAML) into a validated
 * ApiSpec. Throws if the document is malformed or doesn't match the shape.
 */
export function parseSpec(text: string): ApiSpec {
  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (err) {
    throw new Error(`Failed to parse spec: ${(err as Error).message}`);
  }

  const result = apiSpecSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid spec: ${result.error.message}`);
  }

  return result.data as ApiSpec;
}
