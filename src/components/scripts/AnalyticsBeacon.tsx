"use client";

import * as React from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface BeaconPayload {
  sessionId: string;
  event: string;
  key?: string;
  payload?: Record<string, unknown>;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SESSION_KEY = "sjb_sid";
const SESSION_KEY_REF = "sjb_key";

// Scroll depth checkpoints to fire once each per session
const SCROLL_CHECKPOINTS = [25, 50, 75, 100] as const;

// Minimum dwell time before a section_dwell event is worth logging (ms)
const MIN_DWELL_MS = 2000;

// Section IDs to observe for dwell tracking
const TRACKED_SECTIONS = ["projects", "skills", "resume", "now", "contact"];

// ── Fire-and-forget beacon send ───────────────────────────────────────────────
// Never throws. All analytics failures are silent.
function sendBeacon(data: BeaconPayload): void {
  try {
    const body = JSON.stringify(data);

    // navigator.sendBeacon is preferred for session_end (survives page unload)
    // but falls back to fetch with keepalive for all other events.
    if (
      data.event === "session_end" &&
      typeof navigator !== "undefined" &&
      navigator.sendBeacon
    ) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/beacon", blob);
      return;
    }

    fetch("/api/beacon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Silently swallow network errors
    });
  } catch {
    // Silently swallow serialization or other errors
  }
}

// ── Session ID resolution ─────────────────────────────────────────────────────
// Priority: URL __sid param (set by /v/[key] redirect) > existing sessionStorage > new UUID
function resolveSessionId(): string {
  try {
    // Check if we arrived via a /v/[key] referral redirect
    const urlParams = new URLSearchParams(window.location.search);
    const urlSid = urlParams.get("__sid");
    if (urlSid) {
      sessionStorage.setItem(SESSION_KEY, urlSid);
      // Clean __sid from URL without triggering a navigation
      urlParams.delete("__sid");
      urlParams.delete("__key");
      const newUrl =
        window.location.pathname +
        (urlParams.toString() ? `?${urlParams.toString()}` : "") +
        window.location.hash;
      window.history.replaceState(null, "", newUrl);
      return urlSid;
    }

    // Reuse existing session (same tab, same session)
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    // Generate a new session ID
    const newId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, newId);
    return newId;
  } catch {
    // sessionStorage unavailable (private mode, etc.) — use a throwaway ID
    return crypto.randomUUID();
  }
}

// ── Referral key resolution ───────────────────────────────────────────────────
function resolveKey(): string | undefined {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlKey = urlParams.get("__key");
    if (urlKey) {
      sessionStorage.setItem(SESSION_KEY_REF, urlKey);
      return urlKey;
    }
    return sessionStorage.getItem(SESSION_KEY_REF) ?? undefined;
  } catch {
    return undefined;
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export function AnalyticsBeacon() {
  const sessionIdRef = React.useRef<string | null>(null);
  const keyRef = React.useRef<string | undefined>(undefined);
  const startTimeRef = React.useRef<number>(Date.now());
  const scrollCheckpointsFired = React.useRef<Set<number>>(new Set());
  const sectionEntryTimes = React.useRef<Map<string, number>>(new Map());
  const sectionDwellFired = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    // ── Resolve session identity ──────────────────────────────────────────────
    const sessionId = resolveSessionId();
    const key = resolveKey();
    sessionIdRef.current = sessionId;
    keyRef.current = key;
    startTimeRef.current = Date.now();

    // ── visit_confirmed: only once per session, not on every reload ───────────
    const CONFIRMED_KEY = "sjb_confirmed";
    const alreadyConfirmed = sessionStorage.getItem(CONFIRMED_KEY) === sessionId;
    if (!alreadyConfirmed) {
      sendBeacon({ sessionId, event: "visit_confirmed", key });
      try { sessionStorage.setItem(CONFIRMED_KEY, sessionId); } catch {}
    }

    // ── scroll_depth: fire once per checkpoint ────────────────────────────────
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;

      const pct = Math.round((scrollTop / docHeight) * 100);

      for (const checkpoint of SCROLL_CHECKPOINTS) {
        if (pct >= checkpoint && !scrollCheckpointsFired.current.has(checkpoint)) {
          scrollCheckpointsFired.current.add(checkpoint);
          sendBeacon({
            sessionId,
            event: "scroll_depth",
            key,
            payload: { depth: checkpoint },
          });
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // ── section_dwell: IntersectionObserver per tracked section ───────────────
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const sectionId = entry.target.id;
          if (!sectionId) continue;

          if (entry.isIntersecting) {
            // Section entered viewport — record entry time
            sectionEntryTimes.current.set(sectionId, Date.now());
          } else {
            // Section left viewport — compute dwell time
            const entryTime = sectionEntryTimes.current.get(sectionId);
            if (entryTime == null) continue;

            const ms = Date.now() - entryTime;
            sectionEntryTimes.current.delete(sectionId);

            // Only log meaningful dwell, and only once per section per session
            if (ms >= MIN_DWELL_MS && !sectionDwellFired.current.has(sectionId)) {
              sectionDwellFired.current.add(sectionId);
              sendBeacon({
                sessionId,
                event: "section_dwell",
                key,
                payload: { section: sectionId, ms },
              });
            }
          }
        }
      },
      { threshold: 0.3 } // section must be 30% visible to count
    );

    for (const id of TRACKED_SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    // ── link_click: event delegation on document ──────────────────────────────
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href") ?? "";
      const label = (target.textContent ?? "").trim().slice(0, 128);

      // Only log external links and named anchor links — skip internal nav
      const isExternal = href.startsWith("http");
      const isAnchor = href.startsWith("#");
      const isFile = href.includes(".pdf");

      if (isExternal || isAnchor || isFile) {
        sendBeacon({
          sessionId,
          event: "link_click",
          key,
          payload: { href: href.slice(0, 512), label },
        });
      }
    };

    document.addEventListener("click", handleClick);

    // ── session_end: pagehide fires reliably on tab close / navigation ────────
const handlePageHide = () => {
  const ENDED_KEY = "sjb_ended";
  try {
    if (sessionStorage.getItem(ENDED_KEY) === sessionId) return;
    sessionStorage.setItem(ENDED_KEY, sessionId);
  } catch {}

  const duration_ms = Date.now() - startTimeRef.current;
  sendBeacon({
    sessionId,
    event: "session_end",
    key,
    payload: { duration_ms },
  });

  // Flush sections still in viewport
  for (const [sectionId, entryTime] of sectionEntryTimes.current.entries()) {
    const ms = Date.now() - entryTime;
    if (ms >= MIN_DWELL_MS && !sectionDwellFired.current.has(sectionId)) {
      sendBeacon({
        sessionId,
        event: "section_dwell",
        key,
        payload: { section: sectionId, ms },
      });
    }
  }
};

    window.addEventListener("pagehide", handlePageHide);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("click", handleClick);
      observer.disconnect();
    };
  }, []); // Runs once on mount

  // Renders nothing — purely a side-effect component
  return null;
}