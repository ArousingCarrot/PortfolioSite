import { type NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "sjb_admin_session";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/admin/login", request.url),
    { status: 303 }
  );
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}