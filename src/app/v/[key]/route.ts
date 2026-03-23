import { type NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// ── Cloudflare env type ───────────────────────────────────────────────────────
interface CloudflareEnv {
  ANALYTICS_DB: D1Database;
  ANALYTICS_KV: KVNamespace;
}

// ── Tier classification ───────────────────────────────────────────────────────
// Tier 1: referral link fired (key present)          — known context, high intent
// Tier 2: came from LinkedIn                         — human, unknown context
// Tier 3: came from ATS / resume tool                — mixed signal
// Tier 4: everything else (direct, unknown)          — log silently

const ATS_PATTERNS = [
  "greenhouse.io",
  "lever.co",
  "workday.com",
  "myworkdayjobs.com",
  "icims.com",
  "resumeviewer",
];

function classifyTier(referer: string | null, hasKey: boolean): number {
  if (hasKey) return 1;
  if (!referer) return 4;
  const r = referer.toLowerCase();
  if (r.includes("linkedin.com")) return 2;
  if (ATS_PATTERNS.some((p) => r.includes(p))) return 3;
  return 4;
}

// ── IP hashing ────────────────────────────────────────────────────────────────
// Never store raw IPs. SHA-256, keep first 8 hex chars only.
async function hashIp(ip: string): Promise<string> {
  const encoded = new TextEncoder().encode(ip);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  const hex = Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 8);
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  // Always redirect regardless of what happens with analytics.
  // Analytics errors must never block the visitor.
  const redirectTo = new URL("/", request.url);

  try {
    // getCloudflareContext is async in @opennextjs/cloudflare
    const ctx = await getCloudflareContext();
    const env = ctx.env as unknown as CloudflareEnv;
    const db = env.ANALYTICS_DB;
    const kv = env.ANALYTICS_KV;

    // params is a Promise in Next.js 15
    const { key: rawKey } = await params;
    const normalizedKey = rawKey?.trim().toLowerCase();

    if (!normalizedKey) {
      return NextResponse.redirect(redirectTo, { status: 302 });
    }

    // ── Check key exists and is active ───────────────────────────────────────
    const keyRow = await db
      .prepare("SELECT key, label FROM referral_keys WHERE key = ? AND active = 1")
      .bind(normalizedKey)
      .first<{ key: string; label: string }>();

    // Unknown or deactivated key: still redirect, log as tier-4 so we can
    // see probing attempts, but don't associate an invalid key with the event.
    const validKey = keyRow !== null;

    // ── Gather request metadata ───────────────────────────────────────────────
    const cf = (request as unknown as { cf?: Record<string, unknown> }).cf ?? {};
    const country = (cf["country"] as string | undefined) || null;
    const city = (cf["city"] as string | undefined) || null;
    const cfThreatScore = cf["threatScore"] != null && cf["threatScore"] !== "null"
        ? Number(cf["threatScore"])
        : null;

    const referer = request.headers.get("referer")?.slice(0, 512) ?? null;
    const ua = request.headers.get("user-agent")?.slice(0, 512) ?? null;
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const ipHash = await hashIp(ip);

    const tier = classifyTier(referer, validKey);

    // ── KV deduplication: first-open detection ────────────────────────────────
    // Key: "visit:{key}:{ipHash}" — expires after 24 hours.
    // Lets us flag whether a given referral key was opened multiple times
    // from the same hashed IP (e.g. hiring manager opens the link twice).
    const dedupKey = `visit:${normalizedKey}:${ipHash}`;
    const alreadySeen = await kv.get(dedupKey);
    const isFirstOpen = alreadySeen === null;

    if (isFirstOpen) {
      await kv.put(dedupKey, new Date().toISOString(), {
        expirationTtl: 86400, // 24 hours
      });
    }

    // ── Generate a session ID for this server-side hit ────────────────────────
    // Passed to the client via redirect query param so the beacon can use the
    // same session ID, correlating server and client events in D1.
    const serverSessionId = crypto.randomUUID();

    // ── Write visit_server event to D1 ───────────────────────────────────────
    await db
      .prepare(`
        INSERT INTO events
          (session_id, key, tier, event, ts, country, city, referer, ua, cf_threat_score, has_js, payload)
        VALUES
          (?, ?, ?, 'visit_server', ?, ?, ?, ?, ?, ?, 0, ?)
      `)
      .bind(
        serverSessionId,
        validKey ? normalizedKey : null, // don't log invalid keys
        tier,
        new Date().toISOString(),
        country,
        city,
        referer,
        ua,
        cfThreatScore,
        JSON.stringify({ isFirstOpen, validKey })
      )
      .run();

    // ── Redirect to homepage with session correlation params ──────────────────
    // The client beacon reads __sid on load and uses it as its session ID so
    // server and client events share the same session_id in D1.
    redirectTo.searchParams.set("__sid", serverSessionId);
    if (validKey) {
      redirectTo.searchParams.set("__key", normalizedKey);
    }
  } catch (err) {
    // Analytics failure must never surface to the visitor.
    console.error("[analytics] /v/[key] error:", err);
  }

  return NextResponse.redirect(redirectTo, { status: 302 });
}