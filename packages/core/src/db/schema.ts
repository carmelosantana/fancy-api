import { sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const apis = sqliteTable("apis", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  config: text("config").notNull().default("{}"),
  readKey: text("read_key"),
  writeTokenHash: text("write_token_hash"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const collections = sqliteTable(
  "collections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    apiId: integer("api_id")
      .notNull()
      .references(() => apis.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    schema: text("schema").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    apiIdSlugIdx: uniqueIndex("collections_api_id_slug_idx").on(table.apiId, table.slug),
  }),
);

export const records = sqliteTable("records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  collectionId: integer("collection_id")
    .notNull()
    .references(() => collections.id),
  data: text("data").notNull(),
  seq: integer("seq").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const requestLog = sqliteTable("request_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  apiId: integer("api_id"),
  ts: integer("ts").notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  status: integer("status").notNull(),
});
