import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

const isMockAuthEnabled = () => {
  return process.env.ENABLE_MOCK_AUTH === "true";
};

export async function middleware(request: NextRequest) {
  const { nextUrl, cookies } = request;
  const path = nextUrl.pathname;

  // Define route scopes that require authenticated sessions
  const isProtectedRoute =
    path.startsWith("/profile") ||
    path.startsWith("/owner/submit") ||
    path.startsWith("/owner/track");

  if (isProtectedRoute) {
    const sessionToken = cookies.get("realtynow_session");

    if (!sessionToken || !sessionToken.value) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", path + nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    // A. Bypass check if mock authentication is active
    if (isMockAuthEnabled() && sessionToken.value === "mock-session-jwt-xyz") {
      return NextResponse.next();
    }

    // B. Verify actual Supabase JWT access token session by calling GoTrue directly
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${sessionToken.value}`,
        },
      });

      if (!response.ok) {
        throw new Error("Invalid session token");
      }
    } catch (err) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", path + nextUrl.search);

      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("realtynow_session");
      return response;
    }
  }

  return NextResponse.next();
}

// Matching paths configuration
export const config = {
  matcher: ["/profile/:path*", "/owner/submit/:path*", "/owner/track/:path*"],
};
