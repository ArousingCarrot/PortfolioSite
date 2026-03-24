"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";
import type {
  KeyStat, DayStat, EventStat, CountryStat, KeyDayStat,
} from "@/app/admin/analytics/page";
import { countryName } from "@/lib/countries";

// ── ISO numeric id -> alpha-2 (for matching world-atlas geo ids to Cloudflare country codes) ──
const N2A: Record<string, string> = {
  "004":"AF","008":"AL","012":"DZ","020":"AD","024":"AO","028":"AG","032":"AR",
  "036":"AU","040":"AT","031":"AZ","044":"BS","048":"BH","050":"BD","052":"BB",
  "112":"BY","056":"BE","084":"BZ","204":"BJ","064":"BT","068":"BO","070":"BA",
  "072":"BW","076":"BR","096":"BN","100":"BG","854":"BF","108":"BI","116":"KH",
  "120":"CM","124":"CA","140":"CF","148":"TD","152":"CL","156":"CN","170":"CO",
  "174":"KM","178":"CG","180":"CD","188":"CR","384":"CI","191":"HR","192":"CU",
  "196":"CY","203":"CZ","208":"DK","262":"DJ","212":"DM","214":"DO","218":"EC",
  "818":"EG","222":"SV","226":"GQ","232":"ER","233":"EE","748":"SZ","231":"ET",
  "242":"FJ","246":"FI","250":"FR","266":"GA","270":"GM","268":"GE","276":"DE",
  "288":"GH","300":"GR","308":"GD","320":"GT","324":"GN","624":"GW","328":"GY",
  "332":"HT","340":"HN","348":"HU","352":"IS","356":"IN","360":"ID","364":"IR",
  "368":"IQ","372":"IE","376":"IL","380":"IT","388":"JM","392":"JP","400":"JO",
  "398":"KZ","404":"KE","414":"KW","417":"KG","418":"LA","428":"LV","422":"LB",
  "426":"LS","430":"LR","434":"LY","440":"LT","442":"LU","450":"MG","454":"MW",
  "458":"MY","462":"MV","466":"ML","470":"MT","478":"MR","480":"MU","484":"MX",
  "498":"MD","496":"MN","504":"MA","508":"MZ","104":"MM","516":"NA","524":"NP",
  "528":"NL","554":"NZ","558":"NI","562":"NE","566":"NG","578":"NO","512":"OM",
  "586":"PK","591":"PA","598":"PG","600":"PY","604":"PE","608":"PH","616":"PL",
  "620":"PT","634":"QA","642":"RO","643":"RU","646":"RW","682":"SA","686":"SN",
  "688":"RS","690":"SC","694":"SL","702":"SG","703":"SK","705":"SI","090":"SB",
  "706":"SO","710":"ZA","728":"SS","724":"ES","144":"LK","729":"SD","740":"SR",
  "752":"SE","756":"CH","760":"SY","762":"TJ","834":"TZ","764":"TH","626":"TL",
  "768":"TG","780":"TT","788":"TN","792":"TR","795":"TM","800":"UG","804":"UA",
  "784":"AE","826":"GB","840":"US","858":"UY","860":"UZ","548":"VU","862":"VE",
  "704":"VN","887":"YE","894":"ZM","716":"ZW","408":"KP","410":"KR","807":"MK",
  "132":"CV","296":"KI","584":"MH","583":"FM","585":"PW","882":"WS","776":"TO",
  "798":"TV","158":"TW","304":"GL","344":"HK","446":"MO","275":"PS",
};

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type Props = {
  keyStats: KeyStat[];
  timeline: DayStat[];
  eventStats: EventStat[];
  countryStats: CountryStat[];
  keyTimeline: KeyDayStat[];
  liveCount: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fillTimeline(data: DayStat[], days = 30): DayStat[] {
  const map = new Map(data.map((d) => [d.day, d.visits]));
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return { day: key, visits: map.get(key) ?? 0 };
  });
}

function groupKeyTimeline(rows: KeyDayStat[]): Map<string, DayStat[]> {
  const map = new Map<string, DayStat[]>();
  for (const r of rows) {
    if (!map.has(r.key)) map.set(r.key, []);
    map.get(r.key)!.push({ day: r.day, visits: r.visits });
  }
  return map;
}

// ── Timeline chart ────────────────────────────────────────────────────────────

function TimelineChart({ data }: { data: DayStat[] }) {
  const filled = fillTimeline(data);
  const max = Math.max(...filled.map((d) => d.visits), 1);
  const W = 600; const H = 130;
  const PAD = { top: 12, right: 12, bottom: 28, left: 28 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const pts = filled.map((d, i) => ({
    x: PAD.left + (i / (filled.length - 1)) * cW,
    y: PAD.top + cH - (d.visits / max) * cH,
    ...d,
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x},${PAD.top + cH} L${pts[0].x},${PAD.top + cH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }}>
      {[0, 0.5, 1].map((t) => (
        <line key={t} x1={PAD.left} y1={PAD.top + cH * (1 - t)} x2={PAD.left + cW} y2={PAD.top + cH * (1 - t)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}
      {[0, Math.ceil(max / 2), max].map((v, i) => (
        <text key={i} x={PAD.left - 5} y={PAD.top + cH - (v / max) * cH + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.28)">{v}</text>
      ))}
      <path d={area} fill="rgba(253,224,71,0.07)" />
      <path d={line} fill="none" stroke="rgba(253,224,71,0.65)" strokeWidth="1.5" strokeLinejoin="round" />
      {pts.filter((p) => p.visits > 0).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#fde047" opacity="0.85" />
      ))}
      {[0, Math.floor(filled.length / 2), filled.length - 1].map((i) => (
        <text key={i} x={pts[i].x} y={H - 5} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.28)">{filled[i].day.slice(5)}</text>
      ))}
    </svg>
  );
}

// ── Sparkline (per-key 30-day bar chart) ──────────────────────────────────────

function Sparkline({ data }: { data: DayStat[] }) {
  const filled = fillTimeline(data);
  const max = Math.max(...filled.map((d) => d.visits), 1);
  const W = 400; const H = 52;
  const bw = (W / filled.length) - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-3" style={{ height: 52 }}>
      {filled.map((d, i) => {
        const bh = ((d.visits / max) * (H - 14));
        return (
          <rect key={d.day} x={i * (W / filled.length)} y={H - 14 - bh} width={bw} height={bh} fill="rgba(253,224,71,0.55)" rx={1} />
        );
      })}
      {[0, 14, 29].map((i) => (
        <text key={i} x={i * (W / 30) + bw / 2} y={H - 2} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.3)">{filled[i]?.day.slice(5)}</text>
      ))}
    </svg>
  );
}

// ── World map ─────────────────────────────────────────────────────────────────

function WorldMap({ countryStats }: { countryStats: CountryStat[] }) {
  const counts = new Map(countryStats.map((c) => [c.country, c.visits]));
  const max = Math.max(...countryStats.map((c) => c.visits), 1);
  const [paths, setPaths] = React.useState<Array<{ d: string; id: string; name: string }>>([]);
  const [tooltip, setTooltip] = React.useState<{ name: string; count: number; x: number; y: number } | null>(null);

  React.useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then((topo: unknown) => {
        const topology = topo as Topology;
        const countries = topojson.feature(topology, (topology as any).objects.countries);      
        
        const W = 800; const H = 450;

        // Simple equirectangular projection
        const project = (lon: number, lat: number): [number, number] => [
          (lon + 180) * (W / 360),
          (90 - lat) * (H / 180),
        ];

        const coordsToD = (coords: number[][][]): string =>
          coords.map((ring) =>
            ring.map((pt, i) => {
              const [x, y] = project(pt[0], pt[1]);
              return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(" ") + " Z"
          ).join(" ");

        const result: Array<{ d: string; id: string; name: string }> = [];
        for (const feature of (countries as any).features) {
          const { type, coordinates } = feature.geometry;
          const id = String(feature.id);
          const alpha2 = N2A[id] ?? "";
          const name = feature.properties?.name ?? alpha2;
          let d = "";
          if (type === "Polygon") d = coordsToD(coordinates);
          else if (type === "MultiPolygon") d = coordinates.map((c: number[][][]) => coordsToD(c)).join(" ");
          if (d) result.push({ d, id: alpha2, name });
        }
        setPaths(result);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="relative">
      <svg
        viewBox="0 0 800 450"
        className="w-full"
        style={{ height: "auto" }}
        onMouseLeave={() => setTooltip(null)}
      >
        {paths.map((p) => {
          const count = counts.get(p.id) ?? 0;
          const opacity = count > 0 ? 0.18 + (count / max) * 0.82 : 0;
          return (
            <path
              key={p.id || p.name}
              d={p.d}
              fill={count > 0 ? `rgba(253,224,71,${opacity.toFixed(2)})` : "rgba(255,255,255,0.04)"}
              stroke="rgba(255,255,255,0.07)"
              strokeWidth={0.4}
              style={{ cursor: count > 0 ? "pointer" : "default" }}
              onMouseEnter={(e) => setTooltip({ name: p.name, count, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
            />
          );
        })}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-xl border border-neutral-700 bg-neutral-900/95 px-3 py-2 text-xs text-neutral-100 shadow-xl"
          style={{ left: tooltip.x + 12, top: tooltip.y - 36 }}
        >
          <span className="font-medium">{tooltip.name}</span>
          {tooltip.count > 0 && (
            <span className="ml-2 text-yellow-300">{tooltip.count} visit{tooltip.count !== 1 ? "s" : ""}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Event breakdown ───────────────────────────────────────────────────────────

function EventBreakdown({ stats }: { stats: EventStat[] }) {
  const total = stats.reduce((s, e) => s + e.count, 0);
  if (total === 0) return <p className="text-sm text-neutral-500">No events yet.</p>;
  return (
    <div className="space-y-4">
      {stats.map((e) => (
        <div key={e.event}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-xs text-neutral-300">{e.event}</span>
            <span className="text-xs text-neutral-400">
              {e.count} <span className="text-neutral-600">({Math.round((e.count / total) * 100)}%)</span>
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-neutral-800">
            <div className="h-1.5 rounded-full bg-neutral-400/45 transition-all duration-700" style={{ width: `${(e.count / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Key table ─────────────────────────────────────────────────────────────────

function KeyTable({ stats }: { stats: KeyStat[] }) {
  if (stats.length === 0) return <p className="text-sm text-neutral-500">No data yet.</p>;
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-neutral-800 text-neutral-400 text-left">
            <th className="pb-3 pr-6 font-medium">Key</th>
            <th className="pb-3 pr-6 font-medium">Visits</th>
            <th className="pb-3 font-medium">Last visit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900">
          {stats.map((s) => (
            <tr key={s.key} className="text-neutral-300">
              <td className="py-3 pr-6 font-mono text-xs text-yellow-200/80">/v/{s.key}</td>
              <td className="py-3 pr-6">{s.visits}</td>
              <td className="py-3 text-neutral-500 text-xs">{s.last_visit ? s.last_visit.slice(0, 16).replace("T", " ") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export function AnalyticsDashboard({ keyStats, timeline, eventStats, countryStats, keyTimeline, liveCount }: Props) {
  const router = useRouter();
  const [showTable, setShowTable] = React.useState(false);
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);
  const keyTimelineMap = React.useMemo(() => groupKeyTimeline(keyTimeline), [keyTimeline]);

  // Auto-refresh live count every 60s
  React.useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  const totalVisits = keyStats.reduce((s, k) => s + k.visits, 0);
  const activeKeys = keyStats.filter((k) => k.visits > 0).length;
  const confirmRate = (() => {
    const server = eventStats.find((e) => e.event === "visit_server")?.count ?? 0;
    const confirmed = eventStats.find((e) => e.event === "visit_confirmed")?.count ?? 0;
    if (server === 0) return null;
    return Math.round((confirmed / server) * 100);
  })();

  const maxVisits = Math.max(...keyStats.map((s) => s.visits), 1);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Analytics</h1>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-4 mb-8">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-5">
          <p className="text-xs uppercase tracking-widest text-neutral-400">Referral visits</p>
          <p className="mt-2 text-3xl font-semibold">{totalVisits}</p>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-5">
          <p className="text-xs uppercase tracking-widest text-neutral-400">Active keys</p>
          <p className="mt-2 text-3xl font-semibold">{activeKeys}</p>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-5">
          <p className="text-xs uppercase tracking-widest text-neutral-400">JS confirm rate</p>
          <p className="mt-2 text-3xl font-semibold">{confirmRate !== null ? `${confirmRate}%` : "—"}</p>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-5">
          <p className="text-xs uppercase tracking-widest text-neutral-400">Live now</p>
          <div className="mt-2 flex items-center gap-2">
            {liveCount > 0 ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400/60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
                </span>
                <span className="text-3xl font-semibold">{liveCount}</span>
              </>
            ) : (
              <span className="text-3xl font-semibold text-neutral-600">0</span>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-6 mb-6">
        <p className="text-sm font-medium mb-4">Visits — last 30 days</p>
        <TimelineChart data={timeline} />
      </div>

      {/* World map */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-6 mb-6">
        <p className="text-sm font-medium mb-2">Visitors by country</p>
        {countryStats.length === 0 ? (
          <p className="text-sm text-neutral-500 mt-4">No country data yet.</p>
        ) : (
          <>
            <WorldMap countryStats={countryStats} />
            <div className="mt-3 flex flex-wrap gap-2">
              {countryStats.slice(0, 8).map((c) => (
  <span key={c.country} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/40 px-3 py-1 text-xs text-neutral-300">
    <span>{countryName(c.country)}</span>
    <span className="text-yellow-300/80">{c.visits}</span>
  </span>
))}
            </div>
          </>
        )}
      </div>

      {/* Per-key breakdown with sparklines */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-6 mb-6">
        <p className="text-sm font-medium mb-4">Visits by key — click to expand timeline</p>
        {keyStats.length === 0 ? (
          <p className="text-sm text-neutral-500">No referral visits yet.</p>
        ) : (
          <div className="space-y-3">
            {keyStats.map((s) => (
              <div key={s.key} className="rounded-xl border border-neutral-800/60 bg-neutral-950/20 p-4">
                <button
                  onClick={() => setExpandedKey(expandedKey === s.key ? null : s.key)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs text-neutral-300">/v/{s.key}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neutral-400">{s.visits} visit{s.visits !== 1 ? "s" : ""}</span>
                      <span className="text-xs text-neutral-600">{expandedKey === s.key ? "▾" : "▸"}</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-neutral-800">
                    <div className="h-1.5 rounded-full bg-yellow-300/60 transition-all duration-700" style={{ width: `${(s.visits / maxVisits) * 100}%` }} />
                  </div>
                </button>
                {expandedKey === s.key && (
                  <div className="mt-1 border-t border-neutral-800/60 pt-3">
                    <p className="text-xs text-neutral-500 mb-1">
                      Last visit: {s.last_visit ? s.last_visit.slice(0, 16).replace("T", " ") : "—"}
                    </p>
                    <Sparkline data={keyTimelineMap.get(s.key) ?? []} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event breakdown */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-6 mb-6">
        <p className="text-sm font-medium mb-4">Event breakdown</p>
        <EventBreakdown stats={eventStats} />
      </div>

      {/* Raw table */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-6">
        <button onClick={() => setShowTable((v) => !v)} className="flex items-center gap-2 text-sm font-medium text-neutral-200 hover:text-white transition">
          <span>{showTable ? "▾" : "▸"} Key details table</span>
        </button>
        {showTable && <KeyTable stats={keyStats} />}
      </div>
    </div>
  );
}