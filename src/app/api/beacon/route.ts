import { type NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// ── Cloudflare env type ───────────────────────────────────────────────────────
interface CloudflareEnv {
  ANALYTICS_DB: D1Database;
}

// ── Event payload shapes ──────────────────────────────────────────────────────
interface ScrollDepthPayload {
  depth: 25 | 50 | 75 | 100;
}

interface SectionDwellPayload {
  section: string;
  ms: number;
}

interface LinkClickPayload {
  href: string;
  label: string;
}

interface SessionEndPayload {
  duration_ms: number;
}

type EventPayload =
  | ScrollDepthPayload
  | SectionDwellPayload
  | LinkClickPayload
  | SessionEndPayload
  | Record<string, unknown>;

// ── Valid event names (allowlist) ─────────────────────────────────────────────
const VALID_EVENTS = new Set([
  "visit_confirmed",
  "scroll_depth",
  "section_dwell",
  "link_click",
  "session_end",
]);

// ── Request body shape ────────────────────────────────────────────────────────
interface BeaconBody {
  sessionId: string;
  event: string;
  payload?: EventPayload;
  // Optional: key passed from /v/[key] redirect via __key query param
  key?: string;
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Always return 204 regardless of outcome — beacon is fire-and-forget.
  // Errors must never surface to the visitor.
  try {
    const ctx = await getCloudflareContext();
    const env = ctx.env as unknown as CloudflareEnv;
    const db = env.ANALYTICS_DB;

    // ── Parse and validate body ───────────────────────────────────────────────
    let body: BeaconBody;
    try {
      body = (await request.json()) as BeaconBody;
    } catch {
      // Malformed JSON — silently ignore
      return new NextResponse(null, { status: 204 });
    }

    const { sessionId, event, payload, key } = body;

    // sessionId is required — without it we can't correlate events
    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 64) {
      return new NextResponse(null, { status: 204 });
    }

    // Only accept known event names to prevent garbage data
    if (!VALID_EVENTS.has(event)) {
      return new NextResponse(null, { status: 204 });
    }

    const ts = new Date().toISOString();
    const payloadJson = payload ? JSON.stringify(payload) : null;

    // ── Write event to D1 ─────────────────────────────────────────────────────
    await db
      .prepare(`
        INSERT INTO events
          (session_id, key, tier, event, ts, country, city, referer, ua, cf_threat_score, has_js, payload)
        VALUES
          (?, ?, NULL, ?, ?, NULL, NULL, NULL, NULL, NULL, 1, ?)
      `)
      .bind(
        sessionId,
        key && typeof key === "string" ? key.slice(0, 128) : null,
        event,
        ts,
        payloadJson
      )
      .run();

    // ── Update has_js on the visit_server row for this session ────────────────
    // This is the core bot-detection signal: a visit_server row with has_js=0
    // after a few seconds = likely bot or instant bounce.
    // We only do this for visit_confirmed to avoid redundant updates.
    if (event === "visit_confirmed") {
      await db
        .prepare(`
          UPDATE events
          SET has_js = 1
          WHERE session_id = ?
            AND event = 'visit_server'
            AND has_js = 0
        `)
        .bind(sessionId)
        .run();
    }
  } catch (err) {
    // Log for debugging but never expose to client
    console.error("[analytics] /api/beacon error:", err);
  }

  return new NextResponse(null, { status: 204 });
}