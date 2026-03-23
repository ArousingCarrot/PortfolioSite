import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const ADMIN_COOKIE = "sjb_admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

// ── Sign a payload with HMAC-SHA256, return hex string ───────────────────────
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    encoder.encode(payload)
  );
  const hex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${payload}.${hex}`;
}

// ── POST: validate password, set signed cookie ────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const password = formData.get("password");

    if (!password || typeof password !== "string") {
      return NextResponse.redirect(
        new URL("/admin/login?error=1", request.url),
        { status: 303 }
      );
    }

    const storedHash = process.env.ADMIN_PASSWORD;
    const cookieSecret = process.env.COOKIE_SECRET;

    if (!storedHash || !cookieSecret) {
      console.error("[admin/login] ADMIN_PASSWORD or COOKIE_SECRET not set");
      return NextResponse.redirect(
        new URL("/admin/login?error=1", request.url),
        { status: 303 }
      );
    }

    // bcrypt compare — works whether ADMIN_PASSWORD is a hash or plaintext
    // In production, store a bcrypt hash. For initial setup, a plaintext
    // comparison is fine temporarily.
    let valid = false;
    if (storedHash.startsWith("$2")) {
      // Looks like a bcrypt hash
      valid = await bcrypt.compare(password, storedHash);
    } else {
      // Plaintext fallback for initial setup only
      valid = password === storedHash;
    }

    if (!valid) {
      return NextResponse.redirect(
        new URL("/admin/login?error=1", request.url),
        { status: 303 }
      );
    }

    // Sign the session cookie value
    const cookieValue = await signPayload("admin", cookieSecret);

    const response = NextResponse.redirect(new URL("/admin", request.url), {
      status: 303,
    });

    response.cookies.set(ADMIN_COOKIE, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[admin/login] error:", err);
    return NextResponse.redirect(
      new URL("/admin/login?error=1", request.url),
      { status: 303 }
    );
  }
}