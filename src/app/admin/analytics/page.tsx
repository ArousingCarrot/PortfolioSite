import * as React from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";

export const dynamic = "force-dynamic";

interface CloudflareEnv {
  ANALYTICS_DB: D1Database;
}

export type KeyStat = { key: string; visits: number; last_visit: string | null };
export type DayStat = { day: string; visits: number };
export type EventStat = { event: string; count: number };
export type CountryStat = { country: string; visits: number };
export type KeyDayStat = { key: string; day: string; visits: number };

export default async function AnalyticsPage() {
  let keyStats: KeyStat[] = [];
  let timeline: DayStat[] = [];
  let eventStats: EventStat[] = [];
  let countryStats: CountryStat[] = [];
  let keyTimeline: KeyDayStat[] = [];
  let liveCount = 0;
  let dbError = false;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as CloudflareEnv;
    const db = env.ANALYTICS_DB;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [keysRes, timelineRes, eventsRes, countryRes, keyTimelineRes, liveRes] =
      await Promise.all([
        db.prepare(`
          SELECT key, COUNT(*) as visits, MAX(ts) as last_visit
          FROM events
          WHERE event = 'visit_server' AND key IS NOT NULL
          GROUP BY key ORDER BY visits DESC
        `).all<KeyStat>(),

        db.prepare(`
          SELECT substr(ts, 1, 10) as day, COUNT(*) as visits
          FROM events
          WHERE event = 'visit_server' AND substr(ts, 1, 10) >= ?
          GROUP BY day ORDER BY day ASC
        `).bind(thirtyDaysAgo).all<DayStat>(),

        db.prepare(`
          SELECT event, COUNT(*) as count
          FROM events GROUP BY event ORDER BY count DESC
        `).all<EventStat>(),

        db.prepare(`
          SELECT country, COUNT(*) as visits
          FROM events
          WHERE event = 'visit_server' AND country IS NOT NULL
          GROUP BY country ORDER BY visits DESC
        `).all<CountryStat>(),

        db.prepare(`
          SELECT key, substr(ts, 1, 10) as day, COUNT(*) as visits
          FROM events
          WHERE event = 'visit_server' AND key IS NOT NULL
            AND substr(ts, 1, 10) >= ?
          GROUP BY key, day ORDER BY key, day ASC
        `).bind(thirtyDaysAgo).all<KeyDayStat>(),

        db.prepare(`
          SELECT COUNT(DISTINCT session_id) as count
          FROM events WHERE ts >= ?
        `).bind(fiveMinutesAgo).first<{ count: number }>(),
      ]);

    keyStats = keysRes.results ?? [];
    timeline = timelineRes.results ?? [];
    eventStats = eventsRes.results ?? [];
    countryStats = countryRes.results ?? [];
    keyTimeline = keyTimelineRes.results ?? [];
    liveCount = liveRes?.count ?? 0;
  } catch (err) {
    console.error("[admin/analytics] error:", err);
    dbError = true;
  }

  if (dbError) {
    return <p className="text-sm text-red-400">Failed to load analytics data.</p>;
  }

  return (
    <AnalyticsDashboard
      keyStats={keyStats}
      timeline={timeline}
      eventStats={eventStats}
      countryStats={countryStats}
      keyTimeline={keyTimeline}
      liveCount={liveCount}
    />
  );
}