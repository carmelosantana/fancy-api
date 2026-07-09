import type { Db } from "./db/client";
import { deleteApi, getApiBySlug } from "./repo/apis";
import { ingest } from "./ingest/pipeline";

/**
 * The "Hello Tony" demo API: a small, fun quotes collection used by the
 * landing page's live-demo widget (`/api/hello-tony/quotes/random`) and by
 * the Playwright suite as a stable fixture. Real (or real-ish) quotes,
 * varied authors/years/topics — nothing copyrighted at length.
 */
const QUOTES: { author: string; text: string; year: number; topic: string }[] = [
  {
    author: "Winston Churchill",
    text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    year: 1941,
    topic: "perseverance",
  },
  {
    author: "Maya Angelou",
    text: "You may not control all the events that happen to you, but you can decide not to be reduced by them.",
    year: 1997,
    topic: "resilience",
  },
  {
    author: "Steve Jobs",
    text: "Your time is limited, so don't waste it living someone else's life.",
    year: 2005,
    topic: "life",
  },
  {
    author: "Theodore Roosevelt",
    text: "Believe you can and you're halfway there.",
    year: 1901,
    topic: "confidence",
  },
  {
    author: "Eleanor Roosevelt",
    text: "The future belongs to those who believe in the beauty of their dreams.",
    year: 1960,
    topic: "dreams",
  },
  {
    author: "Thomas Edison",
    text: "I have not failed. I've just found 10,000 ways that won't work.",
    year: 1890,
    topic: "perseverance",
  },
  {
    author: "Albert Einstein",
    text: "In the middle of difficulty lies opportunity.",
    year: 1930,
    topic: "opportunity",
  },
  {
    author: "Mark Twain",
    text: "The secret of getting ahead is getting started.",
    year: 1897,
    topic: "productivity",
  },
  {
    author: "Walt Disney",
    text: "The way to get started is to quit talking and begin doing.",
    year: 1955,
    topic: "action",
  },
  {
    author: "Nelson Mandela",
    text: "It always seems impossible until it's done.",
    year: 1994,
    topic: "perseverance",
  },
  {
    author: "Oprah Winfrey",
    text: "Turn your wounds into wisdom.",
    year: 1990,
    topic: "wisdom",
  },
  {
    author: "Henry Ford",
    text: "Whether you think you can, or you think you can't – you're right.",
    year: 1947,
    topic: "mindset",
  },
  {
    author: "Amelia Earhart",
    text: "The most effective way to do it, is to do it.",
    year: 1932,
    topic: "action",
  },
  {
    author: "Dr. Seuss",
    text: "You have brains in your head. You have feet in your shoes. You can steer yourself any direction you choose.",
    year: 1990,
    topic: "creativity",
  },
  {
    author: "Jim Rohn",
    text: "You are the average of the five people you spend the most time with.",
    year: 1985,
    topic: "growth",
  },
  {
    author: "Vince Lombardi",
    text: "It's not whether you get knocked down, it's whether you get up.",
    year: 1965,
    topic: "perseverance",
  },
  {
    author: "Zig Ziglar",
    text: "You don't have to be great to start, but you have to start to be great.",
    year: 1975,
    topic: "motivation",
  },
  {
    author: "Muhammad Ali",
    text: "Don't count the days, make the days count.",
    year: 1978,
    topic: "motivation",
  },
  {
    author: "Coco Chanel",
    text: "In order to be irreplaceable one must always be different.",
    year: 1935,
    topic: "creativity",
  },
  {
    author: "Tony Robbins",
    text: "The only impossible journey is the one you never begin.",
    year: 1991,
    topic: "motivation",
  },
  {
    author: "J.K. Rowling",
    text: "It is our choices that show what we truly are, far more than our abilities.",
    year: 2000,
    topic: "choices",
  },
  {
    author: "Wayne Gretzky",
    text: "You miss 100% of the shots you don't take.",
    year: 1983,
    topic: "sports",
  },
];

export interface SeedResult {
  apiId: number;
  inserted: number;
}

/**
 * Seed the `hello-tony` demo API (a `quotes` collection: author/text/year/topic).
 *
 * Idempotent by default: if `hello-tony` already exists, this is a no-op and
 * returns its existing `apiId` with `inserted: 0`. Pass `{ overwrite: true }`
 * to drop and recreate it (used by `SEED_OVERWRITE=1` in `scripts/seed.ts`).
 */
export async function seedHelloTony(db: Db, opts?: { overwrite?: boolean }): Promise<SeedResult> {
  const existing = await getApiBySlug(db, "hello-tony");
  if (existing) {
    if (!opts?.overwrite) {
      return { apiId: existing.id, inserted: 0 };
    }
    await deleteApi(db, "hello-tony");
  }

  const rows = QUOTES.map((q) => ({
    author: q.author,
    text: q.text,
    year: String(q.year),
    topic: q.topic,
  }));

  const result = await ingest(db, {
    apiSlug: "hello-tony",
    apiName: "Hello Tony",
    description: "A pocket-sized quote API — fun, real-ish motivational quips for the demo.",
    collectionSlug: "quotes",
    collectionName: "Quotes",
    rows,
  });

  return { apiId: result.apiId, inserted: result.inserted };
}
