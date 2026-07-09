import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * Generates a random, URL-safe token suitable for use as a write token.
 * 32 base64url characters (~24 bytes of entropy).
 */
export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Hashes a token with SHA-256, returning a hex digest safe to store at rest.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Verifies a plaintext token against a stored hash using a constant-time
 * comparison to avoid leaking timing information.
 */
export function verifyToken(token: string, hash: string): boolean {
  const candidate = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
