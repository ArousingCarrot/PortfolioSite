import { type NextRequest, NextResponse } from "next/server";

// Cookie name for the admin session
const ADMIN_COOKIE = "sjb_admin_session";

// ── Simple HMAC signature verification ───────────────────────────────────────
// Cookie value format: "{payload}.{hex-signature}"
// Payload is just "admin" — single-user, no claims needed.
async function verifySignedCookie(
  value: string,
  secret: string
): Promise<boolean> {
  try {
    const lastDot = value.lastIndexOf(".");
    if (lastDot === -1) return false;

    const payload = value.slice(0, lastDot);
    const signature = value.slice(lastDot + 1);

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Decode hex signature back to bytes
    const sigBytes = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []
    );

    return await crypto.subtle.verify(
      "HMAC",
      keyMaterial,
      sigBytes,
      encoder.encode(payload)
    );
  } catch {
    return false;
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only guard /admin routes — pass everything else through immediately
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // /admin/login is always accessible (otherwise you can never log in)
  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const cookieSecret = process.env.COOKIE_SECRET;

  // If COOKIE_SECRET isn't configured, block access entirely
  if (!cookieSecret) {
    console.error("[middleware] COOKIE_SECRET is not set");
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const cookie = request.cookies.get(ADMIN_COOKIE);

  if (!cookie?.value) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const valid = await verifySignedCookie(cookie.value, cookieSecret);

  if (!valid) {
    // Cookie present but invalid/tampered — redirect to login
    const response = NextResponse.redirect(
      new URL("/admin/login", request.url)
    );
    // Clear the bad cookie
    response.cookies.delete(ADMIN_COOKIE);
    return response;
  }

  // Valid session — allow through
  return NextResponse.next();
}

export const config = {
  // Run middleware on all /admin routes
  matcher: ["/admin/:path*"],
};