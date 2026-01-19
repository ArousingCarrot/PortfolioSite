"use client";

import * as React from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  InferencePulseMode,
  InferencePulseState,
} from "./BackgroundEffectsProvider";

type InferenceOverlayProps = {
  sourceGeometry: THREE.BufferGeometry | null;
  pulse: InferencePulseState | null;
  baseOpacity?: number;
  reducedMotion?: boolean;
  mode?: InferencePulseMode;
};

type SegmentAttributes = {
  geometry: THREE.BufferGeometry;
  count: number;
};

const GOLD = new THREE.Color("#bfa15a");
const BASE_GRAY = new THREE.Color("#7b7c84");

function dedupeEdges(
  geometry: THREE.BufferGeometry
): Array<[number, number]> {
  const position = geometry.getAttribute("position");
  if (!position) {
    return [];
  }
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
    for (let i = 0; i < position.count; i += 3) {
      addEdge(i, i + 1);
      addEdge(i + 1, i + 2);
      addEdge(i + 2, i);
    }
  }

  return result;
}

function buildSegments(
  geometry: THREE.BufferGeometry,
  targetCount: number
): SegmentAttributes {
  const edges = dedupeEdges(geometry);
  const position = geometry.getAttribute("position");
  if (!position || edges.length === 0) {
    return { geometry: new THREE.BufferGeometry(), count: 0 };
  }

  const segmentCount = Math.min(targetCount, edges.length);
  const positions = new Float32Array(segmentCount * 2 * 3);
  const seeds = new Float32Array(segmentCount * 2);
  const progresses = new Float32Array(segmentCount * 2);

  for (let i = 0; i < segmentCount; i += 1) {
    const edge = edges[Math.floor(Math.random() * edges.length)];
    const [aIndex, bIndex] = edge;

    const ax = position.getX(aIndex);
    const ay = position.getY(aIndex);
    const az = position.getZ(aIndex);
    const bx = position.getX(bIndex);
    const by = position.getY(bIndex);
    const bz = position.getZ(bIndex);

    const offset = i * 6;
    positions[offset] = ax;
    positions[offset + 1] = ay;
    positions[offset + 2] = az;
    positions[offset + 3] = bx;
    positions[offset + 4] = by;
    positions[offset + 5] = bz;

    const seed = Math.random();
    const seedOffset = i * 2;
    seeds[seedOffset] = seed;
    seeds[seedOffset + 1] = seed;
    progresses[seedOffset] = 0;
    progresses[seedOffset + 1] = 1;
  }

  const segmentGeometry = new THREE.BufferGeometry();
  segmentGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  segmentGeometry.setAttribute(
    "aSeed",
    new THREE.BufferAttribute(seeds, 1)
  );
  segmentGeometry.setAttribute(
    "aProgress",
    new THREE.BufferAttribute(progresses, 1)
  );

  return { geometry: segmentGeometry, count: segmentCount };
}

function getTargetSegments(
  width: number,
  height: number,
  dpr: number
): number {
  const minDimension = Math.min(width, height);
  const density = minDimension * dpr;
  if (density < 900) return 90;
  if (density < 1300) return 140;
  if (density < 1700) return 190;
  return 230;
}

function easePulse(progress: number) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  if (clamped < 0.25) {
    return clamped / 0.25;
  }
  const t = (clamped - 0.25) / 0.75;
  return 1 - t * t;
}

export function InferenceOverlay({
  sourceGeometry,
  pulse,
  baseOpacity = 0.05,
  reducedMotion = false,
  mode = "ai",
}: InferenceOverlayProps) {
  const materialRef = React.useRef<THREE.ShaderMaterial | null>(null);
  const pulseRef = React.useRef<InferencePulseState | null>(pulse);
  const { size, gl } = useThree();

  React.useEffect(() => {
    pulseRef.current = pulse;
  }, [pulse]);

  const segmentData = React.useMemo(() => {
    if (!sourceGeometry) {
      return { geometry: new THREE.BufferGeometry(), count: 0 };
    }
    const targetCount = getTargetSegments(
      size.width,
      size.height,
      gl.getPixelRatio()
    );
    return buildSegments(sourceGeometry, targetCount);
  }, [sourceGeometry, size.width, size.height, gl]);

  React.useEffect(() => {
    return () => {
      segmentData.geometry.dispose();
    };
  }, [segmentData.geometry]);

  const material = React.useMemo(() => {
    const shaderMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uPulseStrength: { value: 0 },
        uBaseOpacity: { value: baseOpacity },
        uPulseWidth: { value: 0.24 },
        uBaseColor: { value: BASE_GRAY.clone() },
        uPulseColor: { value: GOLD.clone() },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute float aProgress;
        varying float vSeed;
        varying float vProgress;

        void main() {
          vSeed = aSeed;
          vProgress = aProgress;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uPulseStrength;
        uniform float uBaseOpacity;
        uniform float uPulseWidth;
        uniform vec3 uBaseColor;
        uniform vec3 uPulseColor;
        varying float vSeed;
        varying float vProgress;

        void main() {
          float baseAlpha = uBaseOpacity;
          float pulse = 0.0;
          if (uPulseStrength > 0.001) {
            float head = fract(uTime * 0.6 + vSeed);
            float dist = abs(vProgress - head);
            pulse = smoothstep(uPulseWidth, 0.0, dist) * uPulseStrength;
          }
          float alpha = baseAlpha + pulse * 0.65;
          vec3 color = mix(uBaseColor, uPulseColor, clamp(pulse * 1.6, 0.0, 1.0));
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    return shaderMaterial;
  }, [baseOpacity]);

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
    const pulseColor = mode === "neutral" ? BASE_GRAY : GOLD;
    material.uniforms.uPulseColor.value = pulseColor.clone();
  }, [material, mode]);

  useFrame((_, delta) => {
    if (!materialRef.current) return;
    if (!reducedMotion) {
      materialRef.current.uniforms.uTime.value += delta;
    }

    const currentPulse = pulseRef.current;
    if (!currentPulse) {
      materialRef.current.uniforms.uPulseStrength.value = 0;
      return;
    }

    const elapsed = performance.now() - currentPulse.startTime;
    if (elapsed < 0 || elapsed > currentPulse.durationMs) {
      materialRef.current.uniforms.uPulseStrength.value = 0;
      return;
    }

    const progress = elapsed / currentPulse.durationMs;
    const strength = easePulse(progress) * currentPulse.intensity;
    materialRef.current.uniforms.uPulseStrength.value = strength;
  });

  if (!sourceGeometry || segmentData.count === 0) {
    return null;
  }

  return (
    <lineSegments
      geometry={segmentData.geometry}
      material={material}
      frustumCulled
    />
  );
}