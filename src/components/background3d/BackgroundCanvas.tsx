"use client";

import * as React from "react";
import { Canvas } from "@react-three/fiber";
import { InteractiveModel } from "./InteractiveModel";
import { useBackgroundEffects } from "./BackgroundEffectsProvider";

const MODEL_PATH = "/models/hero.glb";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

function useTouchOnly() {
  const [touchOnly, setTouchOnly] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setTouchOnly(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return touchOnly;
}

export function BackgroundCanvas() {
  const {
    pulse,
    triggerInferencePulse,
    idleEnabled,
    setInferenceIdleEnabled,
  } = useBackgroundEffects();

  const [eventSource, setEventSource] = React.useState<HTMLElement | null>(null);
  const [debug, setDebug] = React.useState(false);
  const [hasPointer, setHasPointer] = React.useState(false);

  const reducedMotion = usePrefersReducedMotion();
  const touchOnly = useTouchOnly();
  const isDev = process.env.NODE_ENV !== "production";

  React.useEffect(() => setEventSource(document.body), []);

  React.useEffect(() => {
    const onPointer = () => setHasPointer(true);
    window.addEventListener("pointermove", onPointer, { once: true });
    window.addEventListener("pointerdown", onPointer, { once: true });
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  // Avoid a preflight HEAD gate here:
  // - Some hosts/CDNs treat HEAD differently than GET.
  // - It introduces a brief "null model" window where the fallback mesh flashes.
  // Let GLTF loading handle readiness via suspense.
  const modelUrl = MODEL_PATH;

  // On touch devices, enable a subtle periodic pulse so the background doesn't feel "static".
  // (Desktop can remain hover-reactive-only.)
  React.useEffect(() => {
    if (reducedMotion) {
      setInferenceIdleEnabled(false);
      return;
    }
    setInferenceIdleEnabled(touchOnly);
  }, [touchOnly, reducedMotion, setInferenceIdleEnabled]);

  // Touch: fire one quick pulse shortly after mount for immediate motion discoverability.
  React.useEffect(() => {
    if (reducedMotion) return;
    if (!touchOnly) return;
    const t = window.setTimeout(() => {
      triggerInferencePulse({ intensity: 0.62, durationMs: 850, mode: "neutral" });
    }, 650);
    return () => window.clearTimeout(t);
  }, [touchOnly, reducedMotion, triggerInferencePulse]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDebug(isDev && params.has("debug3d"));
  }, [isDev]);

  // DEV: press P to trigger a pulse
  React.useEffect(() => {
    if (!isDev) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "p") return;

      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || el?.isContentEditable) return;

      triggerInferencePulse({
        intensity: debug ? 1 : 0.9,
        durationMs: debug ? 1200 : 950,
        mode: "ai",
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDev, triggerInferencePulse, debug]);

  // DEV: self-test pulse after mount
  React.useEffect(() => {
    if (!isDev) return;
    const t = window.setTimeout(() => {
      triggerInferencePulse({
        intensity: debug ? 1 : 0.85,
        durationMs: 900,
        mode: "ai",
      });
    }, 550);
    return () => window.clearTimeout(t);
  }, [isDev, triggerInferencePulse, debug]);

  // Optional idle pulses
  React.useEffect(() => {
    if (!idleEnabled) return;
    if (reducedMotion) return;

    let cancelled = false;
    let timer: number | null = null;

    const schedule = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        triggerInferencePulse({ intensity: 0.65, durationMs: 900, mode: "neutral" });
        schedule();
      }, 5200 + Math.random() * 3600);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [idleEnabled, reducedMotion, triggerInferencePulse]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 3.6], fov: 55 }}
        dpr={[1, 2]}
        eventSource={eventSource ?? undefined}
        eventPrefix="client"
        frameloop={reducedMotion ? "demand" : "always"}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[2.5, 3, 2]} intensity={1.2} />
        <directionalLight position={[-3, -2, -2]} intensity={0.6} />

        <InteractiveModel
          modelUrl={modelUrl}
          modelScale={1}
          reducedMotion={reducedMotion}
          touchOnly={touchOnly}
          hasPointer={hasPointer}
          debug={debug}
          radius={0.7}
          strength={0.4}
          opacity={0.8}
          idleStrength={0.03}
          inferencePulse={pulse}
          inferenceBaseOpacity={debug ? 0.12 : 0.07}
        />
      </Canvas>
    </div>
  );
}
