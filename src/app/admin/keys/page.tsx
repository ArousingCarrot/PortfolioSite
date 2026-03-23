import * as React from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface CloudflareEnv {
  ANALYTICS_DB: D1Database;
}

interface ReferralKey {
  key: string;
  label: string | null;
  company: string | null;
  role: string | null;
  channel: string | null;
  created_at: string | null;
  sent_at: string | null;
  active: number;
  visit_count: number;
}

export default async function KeysPage() {
  let keys: ReferralKey[] = [];
  let dbError = false;

  try {
    const ctx = await getCloudflareContext();
    const env = ctx.env as unknown as CloudflareEnv;
    const db = env.ANALYTICS_DB;

    const result = await db
      .prepare(`
        SELECT
          r.key, r.label, r.company, r.role, r.channel,
          r.created_at, r.sent_at, r.active,
          COUNT(e.id) as visit_count
        FROM referral_keys r
        LEFT JOIN events e ON e.key = r.key AND e.event = 'visit_server'
        GROUP BY r.key
        ORDER BY r.created_at DESC
      `)
      .all<ReferralKey>();

    keys = result.results ?? [];
  } catch (err) {
    console.error("[admin/keys] failed to load keys:", err);
    dbError = true;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Referral Keys</h1>
        <a href="/admin/keys/new" className="rounded-xl border border-yellow-300/40 bg-yellow-300/10 px-4 py-2 text-sm text-yellow-100 hover:bg-yellow-300/15 transition">New key</a>
      </div>

      {dbError && (
        <p className="text-sm text-red-400">Failed to load keys.</p>
      )}

      {!dbError && keys.length === 0 && (
        <p className="text-sm text-neutral-400">
          No keys yet. Create one to start tracking referral visits.
        </p>
      )}

      {!dbError && keys.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 text-left">
                <th className="pb-3 pr-6 font-medium">Key</th>
                <th className="pb-3 pr-6 font-medium">Company</th>
                <th className="pb-3 pr-6 font-medium">Role</th>
                <th className="pb-3 pr-6 font-medium">Channel</th>
                <th className="pb-3 pr-6 font-medium">Visits</th>
                <th className="pb-3 pr-6 font-medium">Status</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {keys.map((k) => (
                <tr key={k.key} className="text-neutral-300">
                  <td className="py-3 pr-6 font-mono text-xs">
                    <a href={"/v/" + k.key} target="_blank" rel="noreferrer" className="text-yellow-200/80 hover:text-yellow-200">/v/{k.key}</a>
                  </td>
                  <td className="py-3 pr-6">{k.company ?? "-"}</td>
                  <td className="py-3 pr-6">{k.role ?? "-"}</td>
                  <td className="py-3 pr-6">{k.channel ?? "-"}</td>
                  <td className="py-3 pr-6">{k.visit_count}</td>
                  <td className="py-3 pr-6">
                    <span className={k.active ? "text-green-400 text-xs" : "text-neutral-500 text-xs"}>
                      {k.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3">
                    <form method="POST" action="/api/admin/keys" className="inline">
                      <input type="hidden" name="key" value={k.key} />
                      <input type="hidden" name="active" value={k.active ? "0" : "1"} />
                      <button type="submit" className="text-xs text-neutral-500 hover:text-neutral-300 transition">
                        {k.active ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}