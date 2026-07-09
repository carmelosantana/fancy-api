import { NextRequest, NextResponse } from "next/server";
import { isAuthed, SESSION_COOKIE } from "@/lib/auth";

// Runs on the Node.js runtime (see next.config.ts `experimental.nodeMiddleware`)
// because `lib/auth.ts` relies on node:crypto, which the default Edge
// middleware runtime doesn't support.
export const config = {
  runtime: "nodejs",
  matcher: ["/admin/:path*", "/api/_manage/:path*"],
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The login route is the one way to *become* authed, so it can't require
  // being authed already.
  if (pathname === "/api/_manage/login") {
    return NextResponse.next();
  }

  if (isAuthed(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/_manage")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}
