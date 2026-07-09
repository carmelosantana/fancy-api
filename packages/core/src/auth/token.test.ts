import { describe, expect, test } from "vitest";
import { generateToken, hashToken, verifyToken } from "./token";

describe("token auth util", () => {
  test("generateToken produces a 32-char base64url string", () => {
    const token = generateToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  test("generateToken produces distinct tokens", () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  test("generate -> hash -> verify round-trips true", () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(verifyToken(token, hash)).toBe(true);
  });

  test("verify returns false for a wrong token", () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(verifyToken(generateToken(), hash)).toBe(false);
  });

  test("hashToken is deterministic", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });
});
