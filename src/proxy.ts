import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/manifest.webmanifest", "/sw.js", "/icons", "/api/cron"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Refreshes the session cookie and verifies the signed token locally (no auth-server round trip on every request);
  // authorization is still enforced by RLS and server checks.
  const { data: auth } = await supabase.auth.getClaims();
  const user = auth?.claims.sub ? { id: auth.claims.sub } : null;

  // Admin area: answer 404 for non-admins before anything renders (pages also re-check on the server).
  if (user && request.nextUrl.pathname.startsWith("/admin")) {
    const { data: membership } = await supabase.from("household_members").select("role").eq("user_id", user.id).maybeSingle();
    if (membership?.role !== "admin") return new NextResponse("Not found", { status: 404 });
  }

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
