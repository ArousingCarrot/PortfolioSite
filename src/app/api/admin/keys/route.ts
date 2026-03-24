import { getCloudflareContext } from "@opennextjs/cloudflare";

interface CloudflareEnv {
  ANALYTICS_DB: D1Database;
}

export async function POST(request: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as CloudflareEnv;
    const db = env.ANALYTICS_DB;

    const formData = await request.formData();
    const key = formData.get("key")?.toString();
    const active = formData.get("active")?.toString();
    const markSent = formData.get("mark_sent")?.toString();

    if (!key) return new Response("Missing key", { status: 400 });

    if (markSent === "1") {
      await db
        .prepare("UPDATE referral_keys SET sent_at = ? WHERE key = ?")
        .bind(new Date().toISOString(), key)
        .run();
    } else if (active !== undefined) {
      await db
        .prepare("UPDATE referral_keys SET active = ? WHERE key = ?")
        .bind(Number(active), key)
        .run();
    }

    return Response.redirect(new URL("/admin/keys", request.url), 303);
  } catch (err) {
    console.error("[api/admin/keys] POST error:", err);
    return new Response("Internal error", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as CloudflareEnv;
    const db = env.ANALYTICS_DB;

    const { key } = await request.json() as { key: string };
    if (!key) return new Response("Missing key", { status: 400 });

    await db.prepare("DELETE FROM referral_keys WHERE key = ?").bind(key).run();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/keys] DELETE error:", err);
    return new Response("Internal error", { status: 500 });
  }
}