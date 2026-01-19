"use client";

import * as React from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type {
  InferencePulseMode,
  InferencePulseState,
} from "./BackgroundEffectsProvider";

type InferenceOverlayProps = {
  sourceGeometry: THREE.BufferGeometry | null;
  pulse: InferencePulseState | null;
  baseOpacity?: number;
  reducedMotion?: boolean;
  mode?: InferencePulseMode;
  debug?: boolean;
};

type SegmentData = {
  geometry: THREE.BufferGeometry;
  count: number;
};

const BASE_GRAY = new THREE.Color("#7b7c84");
const GOLD = new THREE.Color("#bfa15a");
const SYSTEM_GOLD = new THREE.Color("#d1b469");

function hashStringToUint(input: string) {
  // Cheap deterministic hash for stable sampling per-geometry.
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

type PositionAttribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

function dedupeEdges(geometry: THREE.BufferGeometry): Array<[number, number]> {
  const position = geometry.getAttribute("position") as PositionAttribute | undefined;
  if (!position) return [];

  const index = geometry.index;
  const edges = new Set<string>();
  const result: Array<[number, number]> = [];

  const addEdge = (a: number, b: number) => {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    const key = `${min}_${max}`;
    if (edges.has(key)) return;
    edges.add(key);
    result.push([min, max]);
  };

  if (index) {
    const indices = index.array as ArrayLike<number>;
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i];
      const b = indices[i + 1];
      const c = indices[i + 2];
      addEdge(a, b);
      addEdge(b, c);
      addEdge(c, a);
    }
  } else {
    // Non-indexed: every 3 vertices is a triangle.
    for (let i = 0; i < position.count; i += 3) {
      addEdge(i, i + 1);
      addEdge(i + 1, i + 2);
      addEdge(i + 2, i);
    }
  }

  return result;
}

function getTargetSegments(width: number, height: number, dpr: number, debug: boolean) {
  if (debug) return 320;
  const minDimension = Math.min(width, height);
  const density = minDimension * dpr;
  if (density < 900) return 90;
  if (density < 1300) return 150;
  if (density < 1700) return 210;
  return 260;
}

function buildSegments(
  geometry: THREE.BufferGeometry,
  targetCount: number,
  rng: () => number
): SegmentData {
  const position = geometry.getAttribute("position") as PositionAttribute | undefined;
  if (!position) return { geometry: new THREE.BufferGeometry(), count: 0 };

  // Precompute a loose bounding volume for chord selection.
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  const diag = bbox ? bbox.getSize(new THREE.Vector3()).length() : 1;

  const edges = dedupeEdges(geometry);
  if (edges.length === 0) return { geometry: new THREE.BufferGeometry(), count: 0 };

  // Mix: mostly true edges, plus some "telemetry chords" across nearby verts.
  const chordFrac = 0.28;
  const edgeCountTarget = Math.max(0, Math.floor(targetCount * (1 - chordFrac)));
  const chordCountTarget = Math.max(0, targetCount - edgeCountTarget);

  // Deterministic shuffle of edges, take prefix.
  const edgeIndices = new Uint32Array(edges.length);
  for (let i = 0; i < edges.length; i += 1) edgeIndices[i] = i;
  for (let i = edgeIndices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = edgeIndices[i];
    edgeIndices[i] = edgeIndices[j];
    edgeIndices[j] = tmp;
  }

  const usedPairs = new Set<string>();
  const chosen: Array<[number, number, number]> = []; // [a, b, kind]

  const takeEdge = (a: number, b: number, kind: number) => {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    const key = `${min}_${max}`;
    if (usedPairs.has(key)) return false;
    usedPairs.add(key);
    chosen.push([a, b, kind]);
    return true;
  };

  const edgeCount = Math.min(edgeCountTarget, edges.length);
  for (let i = 0; i < edgeCount; i += 1) {
    const [a, b] = edges[edgeIndices[i]];
    takeEdge(a, b, 0);
  }

  // Chords: connect random vertex pairs within a distance band.
  const minChord = diag * 0.08;
  const maxChord = diag * 0.55;
  const maxAttempts = Math.max(400, chordCountTarget * 20);

  const ax = new THREE.Vector3();
  const bx = new THREE.Vector3();
  let attempts = 0;
  while (chosen.length < edgeCount + chordCountTarget && attempts < maxAttempts) {
    attempts += 1;
    const a = Math.floor(rng() * position.count);
    const b = Math.floor(rng() * position.count);
    if (a === b) continue;

    ax.set(position.getX(a), position.getY(a), position.getZ(a));
    bx.set(position.getX(b), position.getY(b), position.getZ(b));
    const d = ax.distanceTo(bx);
    if (d < minChord || d > maxChord) continue;
    takeEdge(a, b, 1);
  }

  const segmentCount = chosen.length;
  if (segmentCount === 0) return { geometry: new THREE.BufferGeometry(), count: 0 };

  const positions = new Float32Array(segmentCount * 2 * 3);
  const seeds = new Float32Array(segmentCount * 2);
  const progresses = new Float32Array(segmentCount * 2);
  const kinds = new Float32Array(segmentCount * 2);

  for (let i = 0; i < segmentCount; i += 1) {
    const [aIndex, bIndex, kind] = chosen[i];

    const axp = position.getX(aIndex);
    const ayp = position.getY(aIndex);
    const azp = position.getZ(aIndex);
    const bxp = position.getX(bIndex);
    const byp = position.getY(bIndex);
    const bzp = position.getZ(bIndex);

    const o = i * 6;
    positions[o] = axp;
    positions[o + 1] = ayp;
    positions[o + 2] = azp;
    positions[o + 3] = bxp;
    positions[o + 4] = byp;
    positions[o + 5] = bzp;

    const seed = rng();
    const so = i * 2;
    seeds[so] = seed;
    seeds[so + 1] = seed;
    progresses[so] = 0;
    progresses[so + 1] = 1;
    kinds[so] = kind;
    kinds[so + 1] = kind;
  }

  const segmentGeometry = new THREE.BufferGeometry();
  segmentGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  segmentGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  segmentGeometry.setAttribute("aProgress", new THREE.BufferAttribute(progresses, 1));
  segmentGeometry.setAttribute("aKind", new THREE.BufferAttribute(kinds, 1));
  segmentGeometry.computeBoundingSphere();

  return { geometry: segmentGeometry, count: segmentCount };
}

function pulseEnvelope(progress01: number) {
  // Quick in, smooth out.
  const t = Math.min(Math.max(progress01, 0), 1);
  const attack = Math.min(t / 0.18, 1);
  const decayT = Math.max((t - 0.18) / 0.82, 0);
  const decay = 1 - decayT * decayT;
  return attack * decay;
}

function getPulseColor(mode: InferencePulseMode) {
  if (mode === "neutral") return BASE_GRAY;
  if (mode === "system") return SYSTEM_GOLD;
  return GOLD;
}

export function InferenceOverlay({
  sourceGeometry,
  pulse,
  baseOpacity = 0.07,
  reducedMotion = false,
  mode = "ai",
  debug = false,
}: InferenceOverlayProps) {
  const materialRef = React.useRef<THREE.ShaderMaterial | null>(null);
  const pulseRef = React.useRef<InferencePulseState | null>(pulse);
  const { size, gl } = useThree();

  React.useEffect(() => {
    pulseRef.current = pulse;
  }, [pulse]);

  const segmentData = React.useMemo(() => {
    if (!sourceGeometry) return { geometry: new THREE.BufferGeometry(), count: 0 };
    const dpr = gl.getPixelRatio();
    const target = getTargetSegments(size.width, size.height, dpr, debug);
    const rng = mulberry32(
      hashStringToUint(sourceGeometry.uuid) ^ (debug ? 0x9e3779b9 : 0)
    );
    return buildSegments(sourceGeometry, target, rng);
  }, [sourceGeometry, size.width, size.height, gl, debug]);

  React.useEffect(() => {
    return () => {
      segmentData.geometry.dispose();
    };
  }, [segmentData.geometry]);

  const material = React.useMemo(() => {
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
      uniforms: {
        uBaseOpacity: { value: baseOpacity },
        uPulseStrength: { value: 0 },
        uPulseT: { value: 0 },
        uPulseSpeed: { value: 0.95 },
        uPulseWidth: { value: 0.22 },
        uBaseColor: { value: BASE_GRAY.clone() },
        uPulseColor: { value: getPulseColor(mode).clone() },
        uDebugBoost: { value: debug ? 1 : 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute float aProgress;
        attribute float aKind;
        varying float vSeed;
        varying float vProgress;
        varying float vKind;

        void main() {
          vSeed = aSeed;
          vProgress = aProgress;
          vKind = aKind;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uBaseOpacity;
        uniform float uPulseStrength;
        uniform float uPulseT;
        uniform float uPulseSpeed;
        uniform float uPulseWidth;
        uniform vec3 uBaseColor;
        uniform vec3 uPulseColor;
        uniform float uDebugBoost;
        varying float vSeed;
        varying float vProgress;
        varying float vKind;

        float sat(float x) { return clamp(x, 0.0, 1.0); }

        void main() {
          // Subtle "watermark" base.
          float vary = mix(0.72, 1.0, fract(vSeed * 19.17));
          float kindFade = mix(1.0, 0.7, sat(vKind));
          float baseAlpha = uBaseOpacity * vary * kindFade;

          // Pulse "head" moves along the segment (vProgress 0..1).
          float pulse = 0.0;
          if (uPulseStrength > 0.001) {
            float head = fract(vSeed + uPulseT * uPulseSpeed);
            float dist = abs(vProgress - head);
            pulse = smoothstep(uPulseWidth, 0.0, dist) * uPulseStrength;
            // Slightly emphasize chords during pulse.
            pulse *= mix(1.0, 1.12, sat(vKind));
          }

          float alpha = sat(baseAlpha + pulse * (0.82 + 0.25 * uDebugBoost));
          float mixAmt = sat(pulse * (1.35 + 0.4 * uDebugBoost));
          vec3 color = mix(uBaseColor, uPulseColor, mixAmt);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    return m;
  }, [baseOpacity, mode, debug]);

  React.useEffect(() => {
    materialRef.current = material;
    return () => {
      material.dispose();
    };
  }, [material]);

  React.useEffect(() => {
    material.uniforms.uBaseOpacity.value = baseOpacity;
  }, [material, baseOpacity]);

  React.useEffect(() => {
    material.uniforms.uPulseColor.value = getPulseColor(mode).clone();
  }, [material, mode]);

  React.useEffect(() => {
    material.uniforms.uDebugBoost.value = debug ? 1 : 0;
  }, [material, debug]);

  useFrame(() => {
    const m = materialRef.current;
    if (!m) return;

    const currentPulse = pulseRef.current;
    if (!currentPulse) {
      m.uniforms.uPulseStrength.value = 0;
      m.uniforms.uPulseT.value = 0;
      return;
    }

    const now = performance.now();
    const elapsed = now - currentPulse.startTime;
    if (elapsed < 0 || elapsed > currentPulse.durationMs) {
      m.uniforms.uPulseStrength.value = 0;
      m.uniforms.uPulseT.value = 0;
      return;
    }

    const p01 = elapsed / currentPulse.durationMs;
    const env = pulseEnvelope(p01);
    const strength = env * currentPulse.intensity;
    m.uniforms.uPulseStrength.value = strength;

    // Reduced-motion: no continuous movement, just a static highlight with fade.
    m.uniforms.uPulseT.value = reducedMotion ? 0 : elapsed / 1000;
  });

  if (!sourceGeometry || segmentData.count === 0) return null;

  return (
    <lineSegments
      geometry={segmentData.geometry}
      material={material}
      frustumCulled={false}
      renderOrder={20}
    />
  );
}
