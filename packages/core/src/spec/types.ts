import type { ColumnSchema } from "../ingest/infer";

export interface CollectionSpec {
  slug: string;
  name: string;
  schema: ColumnSchema[];
  records: Record<string, unknown>[];
}

export interface ApiSpec {
  slug: string;
  name: string;
  description?: string;
  config?: object;
  collections: CollectionSpec[];
}
