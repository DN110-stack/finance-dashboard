import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = new Set(["/login"]);

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, headerValue] of Object.entries(headers)) {
            response.headers.set(key, headerValue);
          }
        },
      },
    }
  );

  // getUser() verifies the token against the Supabase Auth server, unlike
  // getSession() which trusts the (unverified) cookie contents.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  // A bare NextResponse.redirect(...) starts a brand-new response with no
  // Set-Cookie headers. If getUser() just refreshed the session, that
  // refreshed cookie only exists on `response` — redirecting without
  // carrying it over would silently drop it, leaving the browser holding a
  // stale/expired token on the next request.
  function redirectTo(path: string) {
    const redirectResponse = NextResponse.redirect(new URL(path, request.url));
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  if (!user && !isPublicRoute) {
    return redirectTo("/login");
  }

  if (user && isPublicRoute) {
    return redirectTo("/");
  }

  return response;
}
