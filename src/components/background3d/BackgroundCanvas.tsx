"use client";

import * as React from "react";
import { Canvas } from "@react-three/fiber";
import { InteractiveModel } from "./InteractiveModel";

const MODEL_PATH = "/models/hero.glb";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mediaQuery.matches);
    onChange();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function useTouchOnly() {
  const [touchOnly, setTouchOnly] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const onChange = () => setTouchOnly(mediaQuery.matches);
    onChange();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return touchOnly;
}

export function BackgroundCanvas() {
  const [eventSource, setEventSource] = React.useState<HTMLElement | null>(null);
  const [modelUrl, setModelUrl] = React.useState<string | null>(null);
  const [debug, setDebug] = React.useState(false);
  const [hasPointer, setHasPointer] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const touchOnly = useTouchOnly();

  React.useEffect(() => {
    setEventSource(document.body);
  }, []);

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
    const controller = new AbortController();

    fetch(MODEL_PATH, { method: "HEAD", signal: controller.signal })
      .then((response) => {
        if (response.ok) {
          setModelUrl(MODEL_PATH);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has("debug3d"));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 3.6], fov: 55 }}
        dpr={[1, 2]}
        eventSource={eventSource ?? undefined}
        eventPrefix="client"
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[2.5, 3, 2]} intensity={1.2} />
        <directionalLight position={[-3, -2, -2]} intensity={0.6} />

        <InteractiveModel
          modelUrl={modelUrl}
          reducedMotion={reducedMotion}
          touchOnly={touchOnly}
          hasPointer={hasPointer}
          debug={debug}
          radius={0.7}
          strength={0.4}
          opacity={0.5}
          idleStrength={0.02}
        />
      </Canvas>
    </div>
  );
}