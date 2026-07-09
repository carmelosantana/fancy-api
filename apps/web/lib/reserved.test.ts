import { describe, expect, test } from "vitest";
import {
  RESERVED_API_SLUGS,
  RESERVED_COLLECTION_SLUGS,
  validateApiSlug,
  validateCollectionSlug,
} from "./reserved";

describe("validateApiSlug", () => {
  test("accepts a normal lowercase/hyphenated slug", () => {
    expect(validateApiSlug("quotes-api")).toBeNull();
    expect(validateApiSlug("a1")).toBeNull();
    expect(validateApiSlug("books")).toBeNull();
  });

  test("rejects an empty slug", () => {
    expect(validateApiSlug("")).toMatch(/required/i);
  });

  test("rejects reserved api slugs", () => {
    for (const slug of RESERVED_API_SLUGS) {
      expect(validateApiSlug(slug)).toMatch(/reserved/i);
    }
  });

  test("rejects slugs with disallowed characters or casing", () => {
    expect(validateApiSlug("Has-Caps")).toMatch(/invalid/i);
    expect(validateApiSlug("has spaces")).toMatch(/invalid/i);
    expect(validateApiSlug("has_underscore")).toMatch(/invalid/i);
    expect(validateApiSlug("-leading-hyphen")).toMatch(/invalid/i);
    expect(validateApiSlug("trailing-hyphen-")).toMatch(/invalid/i);
    expect(validateApiSlug("emoji-🎉")).toMatch(/invalid/i);
  });
});

describe("validateCollectionSlug", () => {
  test("accepts a normal slug", () => {
    expect(validateCollectionSlug("items")).toBeNull();
    expect(validateCollectionSlug("quotes")).toBeNull();
  });

  test("rejects reserved collection slugs (openapi.json would be shadowed by the static route)", () => {
    for (const slug of RESERVED_COLLECTION_SLUGS) {
      expect(validateCollectionSlug(slug)).toMatch(/reserved/i);
    }
  });

  test("rejects malformed slugs", () => {
    expect(validateCollectionSlug("Bad_Slug")).toMatch(/invalid/i);
    expect(validateCollectionSlug("")).toMatch(/required/i);
  });
});
