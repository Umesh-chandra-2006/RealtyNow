import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { nextUrl, cookies } = request;
  const path = nextUrl.pathname;

  // Define route scopes that require authenticated sessions
  const isProtectedRoute =
    path.startsWith("/profile") ||
    path.startsWith("/owner/submit") ||
    path.startsWith("/owner/track");

  if (isProtectedRoute) {
    const sessionToken = cookies.get("realtynow_session");

    if (!sessionToken || sessionToken.value !== "true") {
      // Unauthenticated access attempt. Redirect to login.
      const loginUrl = new URL("/login", request.url);

      // Preserve the redirect path safely as a parameter
      loginUrl.searchParams.set("redirect", path + nextUrl.search);

      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Matching paths configuration
export const config = {
  matcher: ["/profile/:path*", "/owner/submit/:path*", "/owner/track/:path*"],
};
