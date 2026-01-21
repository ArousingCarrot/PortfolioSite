"use client";

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { InteractiveModel } from "./InteractiveModel";
import { useBackgroundEffects } from "./BackgroundEffectsProvider";

const MODEL_PATH = "/models/hero.glb";

// Pulse tuning
const INTRO_PULSE_DELAY_MS = 650;
const INTRO_PULSE = { intensity: 0.55, durationMs: 850, mode: "system" as const };

const IDLE_PULSE = { intensity: 0.45, durationMs: 780, mode: "system" as const };
const IDLE_PULSE_INTERVAL_MS = { base: 7600, jitter: 4200 };

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

type PointGridProps = {
  /** Plane Z in world units. Should be behind the bust (further from camera). */
  z?: number;
  /** Approximate spacing between points in world units. */
  spacing?: number;
  /** Base point size (pixels, attenuated by distance). */
  pointSize?: number;
  color?: THREE.ColorRepresentation;
  opacity?: number;
  reactStrength?: number;
  /** Reserved for future: mouse position in the grid plane's local XY. */
  mouse?: THREE.Vector2;
};

function PointGrid({
  z = -1.55,
  spacing = 0.17,
  pointSize = 2.25,
  color = "#a9a8b2",
  opacity = 0.16,
  reactStrength = 0,
  mouse,
}: PointGridProps) {
  const { camera, size } = useThree();
  const materialRef = React.useRef<THREE.ShaderMaterial | null>(null);

  const geometry = React.useMemo(() => {
    const g = new THREE.BufferGeometry();

    // Fit the grid to the camera frustum at the chosen plane depth.
    const aspect = size.height > 0 ? size.width / size.height : 1;

    let frustumWidth = 6;
    let frustumHeight = 4;

    // Prefer a perspective camera if available (standard for this scene).
    const anyCam = camera as unknown as { isPerspectiveCamera?: boolean; fov?: number };
    if (anyCam?.isPerspectiveCamera && typeof anyCam.fov === "number") {
      const fovRad = THREE.MathUtils.degToRad(anyCam.fov);
      const camZ = (camera.position?.z ?? 0) as number;
      const dist = Math.max(0.001, Math.abs(camZ - z));
      frustumHeight = 2 * Math.tan(fovRad * 0.5) * dist;
      frustumWidth = frustumHeight * aspect;
    }

    // Slight overscan so points extend past the viewport edges.
    const overscan = 1.12;
    frustumWidth *= overscan;
    frustumHeight *= overscan;

    const cols = Math.max(2, Math.floor(frustumWidth / spacing) + 1);
    const rows = Math.max(2, Math.floor(frustumHeight / spacing) + 1);

    const positions = new Float32Array(cols * rows * 3);

    let o = 0;
    for (let iy = 0; iy < rows; iy += 1) {
      const ty = rows <= 1 ? 0.5 : iy / (rows - 1);
      const y = (ty - 0.5) * frustumHeight;
      for (let ix = 0; ix < cols; ix += 1) {
        const tx = cols <= 1 ? 0.5 : ix / (cols - 1);
        const x = (tx - 0.5) * frustumWidth;

        positions[o] = x;
        positions[o + 1] = y;
        positions[o + 2] = z;
        o += 3;
      }
    }

    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.computeBoundingSphere();
    return g;
  }, [camera, size.width, size.height, spacing, z]);

  React.useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  const material = React.useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      toneMapped: false,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
        uPointSize: { value: pointSize },

        // Reserved for future reactive motion.
        uTime: { value: 0 },
        uReactStrength: { value: reactStrength },
        uMouse: { value: mouse ? mouse.clone() : new THREE.Vector2(999, 999) },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uPointSize;
        uniform float uReactStrength;
        uniform vec2 uMouse;

        varying float vFalloff;

        float sat(float x) { return clamp(x, 0.0, 1.0); }

        void main() {
          vec3 pos = position;

          // Future expansion hook:
          // - Supply uMouse in the grid plane's local XY
          // - Increase uReactStrength > 0
          float d = distance(pos.xy, uMouse);
          float falloff = exp(-d * d * 1.6);
          vFalloff = sat(falloff);

          // Kept at 0.0 for now (reactStrength defaults to 0).
          float wobble = sin(uTime + pos.x * 2.0 + pos.y * 2.0) * 0.03;
          pos.z += wobble * vFalloff * uReactStrength;

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;

          // Size attenuation (perspective). Clamp to keep it subtle.
          float atten = 220.0 / max(1.0, -mv.z);
          gl_PointSize = clamp(uPointSize * atten, 1.0, 4.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vFalloff;

        float sat(float x) { return clamp(x, 0.0, 1.0); }

        void main() {
          // Circular point sprite.
          vec2 p = gl_PointCoord - 0.5;
          float r = length(p);

          // Soft edge.
          float a = 1.0 - smoothstep(0.38, 0.5, r);

          // Keep it static for now, but let future reactive motion brighten near the cursor.
          float alpha = uOpacity * a * mix(1.0, 1.25, vFalloff);
          gl_FragColor = vec4(uColor, sat(alpha));
        }
      `,
    });
  }, [color, opacity, pointSize, reactStrength, mouse]);

  React.useEffect(() => {
    materialRef.current = material;
    return () => material.dispose();
  }, [material]);

  React.useEffect(() => {
    material.uniforms.uReactStrength.value = reactStrength;
  }, [material, reactStrength]);

  React.useEffect(() => {
    material.uniforms.uMouse.value = mouse ? mouse.clone() : new THREE.Vector2(999, 999);
  }, [material, mouse]);

  useFrame((_, delta) => {
    const m = materialRef.current;
    if (!m) return;

    // No visual effect until reactStrength > 0
    m.uniforms.uTime.value += delta;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />;
}

export function BackgroundCanvas() {
  const { pulse, triggerInferencePulse, idleEnabled, setInferenceIdleEnabled } =
    useBackgroundEffects();

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

  // Always enable idle pulses
  React.useEffect(() => {
    setInferenceIdleEnabled(!reducedMotion);
  }, [reducedMotion, setInferenceIdleEnabled]);

  // Kick a single pulse shortly after mount so the effect is immediately discoverable.
  React.useEffect(() => {
    if (reducedMotion) return;
    const t = window.setTimeout(() => {
      triggerInferencePulse(INTRO_PULSE);
    }, INTRO_PULSE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [reducedMotion, triggerInferencePulse]);

  // Periodic idle pulses (tuned frequency + strength).
  React.useEffect(() => {
    if (!idleEnabled) return;
    if (reducedMotion) return;

    let cancelled = false;
    let timer: number | null = null;

    const schedule = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        triggerInferencePulse(IDLE_PULSE);
        schedule();
      }, IDLE_PULSE_INTERVAL_MS.base + Math.random() * IDLE_PULSE_INTERVAL_MS.jitter);
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
        className="absolute inset-0"
        style={{
          opacity: canvasReady ? 1 : 0,
          transition: "opacity 140ms ease-out",
        }}
      >
        <Canvas
          style={{
            background: "transparent",
            width: "100%",
            height: "100%",
            display: "block",
          }}
          camera={{ position: [0, 0, 3.6], fov: 55 }}
          dpr={[1, 2]}
          eventSource={eventSource ?? undefined}
          eventPrefix="client"
          frameloop={reducedMotion ? "demand" : "always"}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.setClearColor(new THREE.Color("#000000"), 0);

            // Mark ready on next animation frame so we never display an uninitialized canvas.
            requestAnimationFrame(() => setCanvasReady(true));
          }}
        >
          {/* Stationary point grid behind the bust (future-proofed for mouse-reactive geometry). */}
          <PointGrid />
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
