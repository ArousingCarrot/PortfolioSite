import * as React from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { countryName } from "@/lib/countries";

export const dynamic = "force-dynamic";

interface CloudflareEnv {
  ANALYTICS_DB: D1Database;
}

export default async function AdminPage() {
  let totalVisits = 0;
  let uniqueSessions = 0;
  let recentEvents: Array<{ event: string; ts: string; key: string | null; country: string | null }> = [];
  let dbError = false;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as CloudflareEnv;
    const db = env.ANALYTICS_DB;

    const [visitsResult, sessionsResult, recentResult] = await Promise.all([
      db.prepare("SELECT COUNT(*) as count FROM events WHERE event = 'visit_server'").first<{ count: number }>(),
      db.prepare("SELECT COUNT(DISTINCT session_id) as count FROM events").first<{ count: number }>(),
      db.prepare("SELECT event, ts, key, country FROM events ORDER BY ts DESC LIMIT 20").all<{ event: string; ts: string; key: string | null; country: string | null }>(),
    ]);

    totalVisits = visitsResult?.count ?? 0;
    uniqueSessions = sessionsResult?.count ?? 0;
    recentEvents = recentResult.results ?? [];
  } catch (err) {
    console.error("[admin] failed to load stats:", err);
    dbError = true;
  }

  return (
  <div>
    <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
    <p className="text-sm text-neutral-400 mb-8">Quick overview. See <a href="/admin/analytics" className="text-yellow-200/80 hover:text-yellow-200 transition">Analytics</a> for full detail.</p>

    <div className="grid gap-4 sm:grid-cols-2 mb-10">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-5">
        <p className="text-xs uppercase tracking-widest text-neutral-400">Total visits</p>
        <p className="mt-2 text-3xl font-semibold">{totalVisits}</p>
      </div>
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-5">
        <p className="text-xs uppercase tracking-widest text-neutral-400">Unique sessions</p>
        <p className="mt-2 text-3xl font-semibold">{uniqueSessions}</p>
      </div>
    </div>

    <h2 className="text-lg font-medium mb-4">Recent events</h2>
    {recentEvents.length === 0 && !dbError && (
      <p className="text-sm text-neutral-400">No events yet.</p>
    )}
    {recentEvents.length > 0 && (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-400 text-left">
              <th className="pb-3 pr-6 font-medium">Event</th>
              <th className="pb-3 pr-6 font-medium">Key</th>
              <th className="pb-3 pr-6 font-medium">Country</th>
              <th className="pb-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900">
            {recentEvents.map((e, i) => (
              <tr key={i} className="text-neutral-300">
                <td className="py-3 pr-6 font-mono text-xs">{e.event}</td>
                <td className="py-3 pr-6">{e.key ?? "-"}</td>
                <td className="py-3 pr-6">{countryName(e.country ?? "")}</td>
                <td className="py-3 text-neutral-500 text-xs">{e.ts.slice(0, 16).replace("T", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
}