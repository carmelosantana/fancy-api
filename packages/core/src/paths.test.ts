import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { resolveDbConfig, resolveDbUrl } from "./paths";

describe("resolveDbConfig", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_AUTH_TOKEN;
    delete process.env.DATABASE_PATH;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  test("a remote DATABASE_URL wins and passes the auth token through", () => {
    process.env.DATABASE_URL = "libsql://my-db.example.com";
    process.env.DATABASE_AUTH_TOKEN = "secret-token";

    expect(resolveDbConfig()).toEqual({
      url: "libsql://my-db.example.com",
      authToken: "secret-token",
    });
  });

  test("accepts http(s) and ws(s) remote URLs too", () => {
    for (const url of [
      "https://my-db.example.com",
      "http://127.0.0.1:8899",
      "wss://my-db.example.com",
      "ws://127.0.0.1:8899",
    ]) {
      process.env.DATABASE_URL = url;
      expect(resolveDbConfig().url).toBe(url);
    }
  });

  test("a remote DATABASE_URL with no auth token still wins (authToken undefined)", () => {
    process.env.DATABASE_URL = "http://127.0.0.1:8899";

    expect(resolveDbConfig()).toEqual({
      url: "http://127.0.0.1:8899",
      authToken: undefined,
    });
  });

  test("falls back to the local file URL when DATABASE_URL is absent", () => {
    expect(resolveDbConfig(process.cwd())).toEqual({
      url: resolveDbUrl(process.cwd()),
    });
  });

  test("falls back to the local file URL when DATABASE_URL isn't remote-shaped", () => {
    // A bare filesystem path (no libsql/http(s)/ws(s) scheme) doesn't count
    // as "remote" — resolveDbConfig should ignore it and fall back to the
    // file-URL resolution, same as if DATABASE_URL were unset.
    process.env.DATABASE_URL = "/not/a/remote/url";

    expect(resolveDbConfig(process.cwd())).toEqual({
      url: resolveDbUrl(process.cwd()),
    });
  });
});
