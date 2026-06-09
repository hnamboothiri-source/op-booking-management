import { NextResponse, type NextRequest } from "next/server";

/**
 * Expose the current pathname to server components via an `x-pathname` header so
 * the console layout can run the department-manager confinement guard (App
 * Router layouts don't receive the pathname directly). This middleware only
 * forwards a header — all real auth/scope logic stays in Node-side code.
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Run on app routes only — skip API, static assets, the login & forbidden pages.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|forbidden).*)"],
};
