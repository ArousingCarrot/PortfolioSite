import { getCloudflareContext } from "@opennextjs/cloudflare";

interface CloudflareEnv {
  ANALYTICS_DB: D1Database;
}

export async function POST(request: Request) {
  try {
    const ctx = await getCloudflareContext();
    const env = ctx.env as unknown as CloudflareEnv;
    const db = env.ANALYTICS_DB;

    const formData = await request.formData();
    const key = formData.get("key")?.toString();
    const active = formData.get("active")?.toString();

    if (!key || active === undefined) {
      return new Response("Missing key or active", { status: 400 });
    }

    await db
      .prepare("UPDATE referral_keys SET active = ? WHERE key = ?")
      .bind(Number(active), key)
      .run();

    return Response.redirect(new URL("/admin/keys", request.url), 303);
  } catch (err) {
    console.error("[api/admin/keys] POST error:", err);
    return new Response("Internal error", { status: 500 });
  }
}