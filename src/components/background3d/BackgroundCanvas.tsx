"use client";

import * as React from "react";
import * as THREE from "three";
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

  // Key fix: hide canvas until WebGL is created to avoid the white flash.
  const [canvasReady, setCanvasReady] = React.useState(false);

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

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDebug(isDev && params.has("debug3d"));
  }, [isDev]);

  // Restore pulse behavior in production:
  // Always enable idle pulses unless reduced motion is requested.
  React.useEffect(() => {
    if (reducedMotion) {
      setInferenceIdleEnabled(false);
    } else {
      setInferenceIdleEnabled(true);
    }
  }, [reducedMotion, setInferenceIdleEnabled]);

  // Kick a single pulse shortly after mount so the effect is immediately discoverable.
  React.useEffect(() => {
    if (reducedMotion) return;
    const t = window.setTimeout(() => {
      triggerInferencePulse({ intensity: 0.7, durationMs: 950, mode: "system" });
    }, 650);
    return () => window.clearTimeout(t);
  }, [reducedMotion, triggerInferencePulse]);

  // Periodic idle pulses (now that idleEnabled is enabled in production too).
  React.useEffect(() => {
    if (!idleEnabled) return;
    if (reducedMotion) return;

    let cancelled = false;
    let timer: number | null = null;

    const schedule = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        triggerInferencePulse({ intensity: 0.65, durationMs: 900, mode: "system" });
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
    <div className="pointer-events-none fixed inset-0 z-10" aria-hidden="true">
      <div
        style={{
          opacity: canvasReady ? 1 : 0,
          transition: "opacity 140ms ease-out",
        }}
      >
        <Canvas
          style={{ background: "transparent" }}
          camera={{ position: [0, 0, 3.6], fov: 55 }}
          dpr={[1, 2]}
          eventSource={eventSource ?? undefined}
          eventPrefix="client"
          frameloop={reducedMotion ? "demand" : "always"}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            // Ensure the first clear is transparent (so the dot grid shows through).
            gl.setClearColor(new THREE.Color("#000000"), 0);

            // Mark ready on next animation frame so we never display an uninitialized canvas.
            requestAnimationFrame(() => setCanvasReady(true));
          }}
        >
          {/* Keep your current lighting setup (the one you said looks perfect). */}
          <ambientLight intensity={0.25} />
          <hemisphereLight
            intensity={0.55}
            color={new THREE.Color("#e6e6ea")}
            groundColor={new THREE.Color("#0a0a0d")}
          />
          <directionalLight position={[2.8, 2.6, 2.2]} intensity={1.55} />
          <directionalLight position={[-2.2, -1.4, -1.8]} intensity={0.55} />
          <directionalLight position={[0.0, 2.2, -2.4]} intensity={0.35} />

          <InteractiveModel
            modelUrl={MODEL_PATH}
            modelScale={1}
            reducedMotion={reducedMotion}
            touchOnly={touchOnly}
            hasPointer={hasPointer}
            debug={debug}
            radius={0.7}
            strength={0.35}
            opacity={0.34}
            idleStrength={0.02}
            inferencePulse={pulse}
            inferenceBaseOpacity={debug ? 0.12 : 0.06}
          />
        </Canvas>
      </div>
    </div>
  );
}
