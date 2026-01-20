"use client";

import * as React from "react";
import * as THREE from "three";
import type { BufferGeometry, Material, Matrix4, Mesh, Object3D } from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

import { useFitToViewport } from "./useFitToViewport";
import { InferenceOverlay } from "./InferenceOverlay";
import {
  useBackgroundEffects,
  type InferencePulseMode,
  type InferencePulseState,
} from "./BackgroundEffectsProvider";

import {
  createShatterWireMaterial,
  FAR_POINT,
  type ShatterWireUniforms,
} from "./createShatterWireMaterial";

type GLTF = {
  scene: THREE.Group;
  scenes: THREE.Group[];
  animations: THREE.AnimationClip[];
  parser?: any;
};

const baseMaterial = new THREE.MeshStandardMaterial({
  color: "#14141c",
  metalness: 0.15,
  roughness: 0.85,
  emissive: "#050508",
  emissiveIntensity: 0.6,
});

function computeRelativeTo(sourceWorld: THREE.Matrix4, targetWorld: THREE.Matrix4) {
  const invTarget = new THREE.Matrix4().copy(targetWorld).invert();
  return new THREE.Matrix4().multiplyMatrices(invTarget, sourceWorld);
}

function pulseEnvelope(p01: number) {
  const t = Math.min(Math.max(p01, 0), 1);
  const attack = Math.min(t / 0.18, 1);
  const decayT = Math.max((t - 0.18) / 0.82, 0);
  const decay = 1 - decayT * decayT;
  return attack * decay;
}

function pulseColor(mode: InferencePulseMode) {
  if (mode === "neutral") return new THREE.Color("#9aa0aa");
  if (mode === "system") return new THREE.Color("#f0d07a");
  return new THREE.Color("#f0d07a"); // ai
}

type InteractiveModelProps = {
  // Hover/idle feel
  radius?: number;
  strength?: number;
  opacity?: number;
  idleStrength?: number;

  // Scale
  modelScale?: number;

  // Model
  modelUrl?: string | null;

  reducedMotion?: boolean;
  touchOnly?: boolean;
  hasPointer?: boolean;
  debug?: boolean;

  inferencePulse?: InferencePulseState | null;
  inferenceMode?: InferencePulseMode;
  inferenceBaseOpacity?: number;
};

type MeshWithGeom = Mesh<BufferGeometry, Material | Material[]>;
function isMeshWithBufferGeometry(obj: Object3D): obj is MeshWithGeom {
  const anyObj = obj as unknown as {
    isMesh?: boolean;
    geometry?: { isBufferGeometry?: boolean };
  };
  return anyObj.isMesh === true && anyObj.geometry?.isBufferGeometry === true;
}

function GlbLayer({
  url,
  material,
  onReady,
  onGeometryReady,
}: {
  url: string;
  material: Material;
  onReady?: () => void;
  onGeometryReady?: (geometry: BufferGeometry, meshWorld: Matrix4) => void;
}) {
  const gltf = useGLTF(url) as unknown as GLTF;

  const scene = React.useMemo<THREE.Group>(
    () => gltf.scene.clone(true) as THREE.Group,
    [gltf.scene]
  );

  React.useEffect(() => {
    const candidateBox: { current: MeshWithGeom | null } = { current: null };
    let bestScore = -Infinity;

    const box = new THREE.Box3();
    const size = new THREE.Vector3();

    scene.traverse((obj) => {
      if (!isMeshWithBufferGeometry(obj)) return;

      const mesh = obj;
      mesh.material = material;

      const geom = mesh.geometry;
      if (!geom.boundingBox) geom.computeBoundingBox();
      if (!geom.boundingBox) return;

      box.copy(geom.boundingBox);
      const score = box.getSize(size).lengthSq();
      if (score > bestScore) {
        bestScore = score;
        candidateBox.current = mesh;
      }
    });

    onReady?.();

    scene.updateWorldMatrix(true, true);

    const candidate = candidateBox.current;
    if (!candidate) return;

    candidate.updateWorldMatrix(true, false);
    onGeometryReady?.(candidate.geometry, candidate.matrixWorld.clone());
  }, [scene, material, onReady, onGeometryReady]);

  return <primitive object={scene} />;
}

function buildFaceAdjacency(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos) return { faceCount: 0, adjacency: [] as number[][] };

  // Build an indexed view of the geometry (either true index, or a deduped index)
  const index = geometry.index;
  let faceCount = 0;

  // canonical vertex id per vertex (for non-indexed fallback)
  let canonical: Uint32Array | null = null;

  if (index) {
    faceCount = Math.floor(index.count / 3);
  } else {
    // Fallback: dedupe vertices by quantized position to recover shared edges
    const eps = 1e-5;
    canonical = new Uint32Array(pos.count);
    const map = new Map<string, number>();
    let next = 0;

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const key =
        `${Math.round(x / eps)}_${Math.round(y / eps)}_${Math.round(z / eps)}`;
      const existing = map.get(key);
      if (existing === undefined) {
        map.set(key, next);
        canonical[i] = next;
        next += 1;
      } else {
        canonical[i] = existing;
      }
    }

    faceCount = Math.floor(pos.count / 3);
  }

  const adjacency: number[][] = Array.from({ length: faceCount }, () => []);
  const edgeToFace = new Map<string, number>();

  const addEdge = (a: number, b: number, face: number) => {
    const min = a < b ? a : b;
    const max = a < b ? b : a;
    const key = `${min}_${max}`;
    const other = edgeToFace.get(key);
    if (other === undefined) {
      edgeToFace.set(key, face);
      return;
    }
    if (other === face) return;

    adjacency[face].push(other);
    adjacency[other].push(face);
  };

  if (index) {
    const arr = index.array as ArrayLike<number>;
    for (let i = 0, f = 0; i < index.count; i += 3, f += 1) {
      const a = arr[i] as number;
      const b = arr[i + 1] as number;
      const c = arr[i + 2] as number;
      addEdge(a, b, f);
      addEdge(b, c, f);
      addEdge(c, a, f);
    }
  } else if (canonical) {
    for (let v = 0, f = 0; v < pos.count; v += 3, f += 1) {
      const a = canonical[v];
      const b = canonical[v + 1];
      const c = canonical[v + 2];
      addEdge(a, b, f);
      addEdge(b, c, f);
      addEdge(c, a, f);
    }
  }

  return { faceCount, adjacency };
}

function buildShatterWireGeometry(sourceGeometry: THREE.BufferGeometry) {
  // We only use this for the gold overlay. Shaded bust remains stable.
  const working = sourceGeometry.clone();

  const { faceCount, adjacency } = buildFaceAdjacency(working);

  // Non-indexed so each face can move independently
  const nonIndexed = working.index ? working.toNonIndexed() : working;
  const pos = nonIndexed.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos) return null;

  const triCount = Math.floor(pos.count / 3);

  // Attributes per vertex
  const aBary = new Float32Array(pos.count * 3);
  const aFaceNormal = new Float32Array(pos.count * 3);
  const aDelay = new Float32Array(pos.count);
  const aBurstW = new Float32Array(pos.count);

  aDelay.fill(1e9);
  aBurstW.fill(0);

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let f = 0; f < triCount; f += 1) {
    const i0 = f * 3 + 0;
    const i1 = f * 3 + 1;
    const i2 = f * 3 + 2;

    v0.set(pos.getX(i0), pos.getY(i0), pos.getZ(i0));
    v1.set(pos.getX(i1), pos.getY(i1), pos.getZ(i1));
    v2.set(pos.getX(i2), pos.getY(i2), pos.getZ(i2));

    e1.subVectors(v1, v0);
    e2.subVectors(v2, v0);
    n.crossVectors(e1, e2).normalize();

    // Same face normal for all 3 verts
    for (const vi of [i0, i1, i2]) {
      const o = vi * 3;
      aFaceNormal[o] = n.x;
      aFaceNormal[o + 1] = n.y;
      aFaceNormal[o + 2] = n.z;
    }

    // Barycentric for wire rendering
    {
      const o0 = i0 * 3;
      const o1 = i1 * 3;
      const o2 = i2 * 3;
      aBary[o0] = 1; aBary[o0 + 1] = 0; aBary[o0 + 2] = 0;
      aBary[o1] = 0; aBary[o1 + 1] = 1; aBary[o1 + 2] = 0;
      aBary[o2] = 0; aBary[o2 + 1] = 0; aBary[o2 + 2] = 1;
    }
  }

  const delayAttr = new THREE.BufferAttribute(aDelay, 1);
  const burstAttr = new THREE.BufferAttribute(aBurstW, 1);
  delayAttr.setUsage(THREE.DynamicDrawUsage);
  burstAttr.setUsage(THREE.DynamicDrawUsage);

  nonIndexed.setAttribute("aBary", new THREE.BufferAttribute(aBary, 3));
  nonIndexed.setAttribute("aFaceNormal", new THREE.BufferAttribute(aFaceNormal, 3));
  nonIndexed.setAttribute("aDelay", delayAttr);
  nonIndexed.setAttribute("aBurstW", burstAttr);

  nonIndexed.computeBoundingSphere();
  nonIndexed.computeBoundingBox();

  return {
    geometry: nonIndexed,
    faceCount,
    adjacency,
    delayAttr,
    burstAttr,
    // Prealloc BFS scratch
    visited: new Int16Array(faceCount),
    queue: new Int16Array(faceCount),
  };
}

export function InteractiveModel({
  radius = 0.65,
  strength = 0.35,
  opacity = 0.34,
  idleStrength = 0.02,
  modelScale = 1,
  modelUrl,
  reducedMotion = false,
  touchOnly = false,
  hasPointer = true,
  debug = false,
  inferencePulse = null,
  inferenceMode = "ai",
  inferenceBaseOpacity = 0.06,
}: InteractiveModelProps) {
  const { triggerInferencePulse } = useBackgroundEffects();

  const baseRef = React.useRef<THREE.Group | null>(null);
  const debugRef = React.useRef<THREE.Mesh | null>(null);

  const ownedSourceGeometryRef = React.useRef<THREE.BufferGeometry | null>(null);
  const [sourceGeometry, setSourceGeometry] =
    React.useState<THREE.BufferGeometry | null>(null);

  const { rootRef, contentRef, fitScale, refit } = useFitToViewport({
    marginY: 0.1,
    marginX: 0.1,
    fit: "both",
  });

  // Gold overlay (shatter-capable)
  const overlayMaterial = React.useMemo(() => {
    const m = createShatterWireMaterial({
      baseColor: "#cdb57a",
      pulseColor: "#f0d07a",
      opacity,
      radius,
      strength,
      idleStrength,
      // Tune these as you like:
      burstAmp: 0.18,
      lineWidth: 0.02,
      lineFeather: 0.012,
      surfaceBias: 0.0025,
    });

    m.transparent = true;
    m.depthWrite = false;
    m.toneMapped = false;

    return m;
  }, [opacity, radius, strength, idleStrength]);

  React.useEffect(() => {
    return () => overlayMaterial.dispose();
  }, [overlayMaterial]);

  const { raycaster, pointer, camera } = useThree();
  const tempPoint = React.useMemo(() => new THREE.Vector3(), []);

  const handleGlbGeometry = React.useCallback(
    (geometry: THREE.BufferGeometry, meshWorld: THREE.Matrix4) => {
      if (ownedSourceGeometryRef.current) {
        ownedSourceGeometryRef.current.dispose();
        ownedSourceGeometryRef.current = null;
      }

      const content = contentRef.current;
      const cloned = geometry.clone();

      if (content) {
        content.updateWorldMatrix(true, false);
        const rel = computeRelativeTo(meshWorld, content.matrixWorld);
        cloned.applyMatrix4(rel);
      }

      cloned.computeBoundingBox();
      cloned.computeBoundingSphere();

      ownedSourceGeometryRef.current = cloned;
      setSourceGeometry(cloned);
    },
    [contentRef]
  );

  React.useEffect(() => {
    return () => {
      if (ownedSourceGeometryRef.current) {
        ownedSourceGeometryRef.current.dispose();
        ownedSourceGeometryRef.current = null;
      }
    };
  }, []);

  const shatter = React.useMemo(() => {
    if (!sourceGeometry) return null;
    return buildShatterWireGeometry(sourceGeometry);
  }, [sourceGeometry]);

  React.useEffect(() => {
    return () => {
      if (shatter?.geometry) shatter.geometry.dispose();
    };
  }, [shatter]);

  // Click → face + k-ring BFS → write (aDelay, aBurstW) → kick click time + global pulse
  const onModelPointerDown = React.useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      // Prevent shatter when clicking foreground UI
      const target = e.nativeEvent.target as HTMLElement | null;
      if (target && target.closest("[data-ui]")) return;

      if (!shatter) return;

      const faceIndex = e.faceIndex;
      if (faceIndex === undefined || faceIndex === null) return;
      if (faceIndex < 0 || faceIndex >= shatter.faceCount) return;

      const K = 4;                 // rings
      const STEP_S = 0.06;         // delay per ring (seconds)

      const delays = shatter.delayAttr.array as Float32Array;
      const bursts = shatter.burstAttr.array as Float32Array;

      delays.fill(1e9);
      bursts.fill(0);

      shatter.visited.fill(-1);
      let qh = 0;
      let qt = 0;

      shatter.visited[faceIndex] = 0;
      shatter.queue[qt++] = faceIndex;

      while (qh < qt) {
        const f = shatter.queue[qh++];
        const d = shatter.visited[f];
        if (d >= K) continue;

        const neigh = shatter.adjacency[f];
        for (let i = 0; i < neigh.length; i += 1) {
          const n = neigh[i];
          if (shatter.visited[n] !== -1) continue;
          shatter.visited[n] = (d + 1) as any;
          shatter.queue[qt++] = n;
        }
      }

      for (let f = 0; f < shatter.faceCount; f += 1) {
        const d = shatter.visited[f];
        if (d === -1) continue;

        const delay = d * STEP_S;
        const w = Math.pow(1 - d / (K + 1), 1.35);

        const base = f * 3;
        delays[base] = delay;
        delays[base + 1] = delay;
        delays[base + 2] = delay;

        bursts[base] = w;
        bursts[base + 1] = w;
        bursts[base + 2] = w;
      }

      shatter.delayAttr.needsUpdate = true;
      shatter.burstAttr.needsUpdate = true;

      const u = overlayMaterial.uniforms as unknown as ShatterWireUniforms;
      u.uClickTime.value = u.uTime.value;

      // Sync with existing global “inference pulse” so everything stays cohesive
      triggerInferencePulse({ intensity: 0.85, durationMs: 950, mode: "ai" });

      e.stopPropagation();
    },
    [shatter, overlayMaterial, triggerInferencePulse]
  );

  useFrame((_, delta) => {
    const u = overlayMaterial.uniforms as unknown as ShatterWireUniforms;

    // Time always ticks so click-wave animates (even if mouse hover is disabled on touch)
    u.uTime.value += delta;

    // Parallax (desktop): subtle rotation of the whole model group
    if (!touchOnly && contentRef.current) {
      const tx = -pointer.y * 0.08;
      const ty = pointer.x * 0.14;
      contentRef.current.rotation.x = THREE.MathUtils.damp(
        contentRef.current.rotation.x,
        tx,
        6,
        delta
      );
      contentRef.current.rotation.y = THREE.MathUtils.damp(
        contentRef.current.rotation.y,
        ty,
        6,
        delta
      );
    }

    // Global pulse (from BackgroundEffectsProvider)
    let gPulse = 0;
    if (inferencePulse) {
      const now = performance.now();
      const elapsed = now - inferencePulse.startTime;
      if (elapsed >= 0 && elapsed <= inferencePulse.durationMs) {
        const p01 = elapsed / inferencePulse.durationMs;
        gPulse = pulseEnvelope(p01) * inferencePulse.intensity;
        u.uPulseColor.value.copy(pulseColor(inferencePulse.mode ?? inferenceMode));
      }
    }
    u.uGlobalPulse.value = gPulse;

    // Reduced motion: disable hover/idle deformation (click-wave still fades via global pulse)
    if (reducedMotion) {
      u.uStrength.value = 0;
      u.uIdleStrength.value = 0;
      u.uMouse.value.copy(FAR_POINT);
      return;
    }

    // Touch: no hover deformation, keep a tiny idle “breath”
    if (touchOnly) {
      u.uStrength.value = 0;
      u.uIdleStrength.value = idleStrength;
      u.uMouse.value.copy(FAR_POINT);
      return;
    }

    // Desktop hover deformation
    u.uStrength.value = strength;
    u.uIdleStrength.value = idleStrength;

    if (!baseRef.current || !hasPointer || !contentRef.current) {
      u.uMouse.value.copy(FAR_POINT);
      return;
    }

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(baseRef.current, true);

    if (hits.length > 0) {
      tempPoint.copy(hits[0].point);
      contentRef.current.worldToLocal(tempPoint);
      u.uMouse.value.copy(tempPoint);
      if (debugRef.current) debugRef.current.position.copy(tempPoint);
    } else {
      u.uMouse.value.copy(FAR_POINT);
    }
  });

  if (!modelUrl) return null;

  return (
    <group ref={rootRef} scale={fitScale * modelScale}>
      <group ref={contentRef}>
        <group ref={baseRef} onPointerDown={onModelPointerDown}>
          <React.Suspense fallback={null}>
            <GlbLayer
              url={modelUrl}
              material={baseMaterial}
              onReady={refit}
              onGeometryReady={handleGlbGeometry}
            />
          </React.Suspense>
        </group>

        {/* Shatter-capable gold wire overlay (generated from geometry) */}
        {shatter ? (
          <mesh
            geometry={shatter.geometry}
            material={overlayMaterial}
            frustumCulled={false}
            renderOrder={15}
          />
        ) : null}

        {/* Existing inference overlay (keep as-is) */}
        {sourceGeometry ? (
          <InferenceOverlay
            sourceGeometry={sourceGeometry}
            pulse={inferencePulse}
            reducedMotion={reducedMotion}
            baseOpacity={inferenceBaseOpacity}
            mode={inferencePulse?.mode ?? inferenceMode}
            debug={debug}
          />
        ) : null}

        {debug ? (
          <mesh ref={debugRef} visible={debug}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshBasicMaterial color="#ff9f1a" />
          </mesh>
        ) : null}
      </group>
    </group>
  );
}
