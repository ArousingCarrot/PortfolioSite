"use client";

import * as React from "react";
import * as THREE from "three";
import type { BufferGeometry, Material, Matrix4, Mesh, Object3D } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  createMouseDisplaceMaterial,
  FAR_POINT,
  MouseDisplaceUniforms,
} from "./createMouseDisplaceMaterial";
import { useFitToViewport } from "./useFitToViewport";
import { InferenceOverlay } from "./InferenceOverlay";
import type { InferencePulseMode, InferencePulseState } from "./BackgroundEffectsProvider";

type GLTF = {
  scene: THREE.Group;
  scenes: THREE.Group[];
  animations: THREE.AnimationClip[];
  parser?: any;
};

const BASE_DARK = new THREE.MeshStandardMaterial({
  color: "#101014",
  roughness: 0.75,
  metalness: 0.05,
  flatShading: true,
});
BASE_DARK.needsUpdate = true;

const GOLD = new THREE.Color("#f0d07a");
const GOLD_BASE = new THREE.Color("#cdb57a");

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
  // You can expand this later; keeping "ai" gold for now.
  if (mode === "neutral") return new THREE.Color("#9aa0aa");
  if (mode === "system") return new THREE.Color("#f0d07a");
  return new THREE.Color("#f0d07a");
}

type InteractiveModelProps = {
  radius?: number;
  strength?: number;
  opacity?: number;
  idleStrength?: number;
  modelScale?: number;
  modelUrl?: string | null;
  reducedMotion?: boolean;
  touchOnly?: boolean;
  hasPointer?: boolean;
  debug?: boolean;

  inferencePulse?: InferencePulseState | null;
  inferenceMode?: InferencePulseMode;
  inferenceBaseOpacity?: number;
};

function useOverlayMaterial(options: {
  radius: number;
  strength: number;
  opacity: number;
  idleStrength: number;
}) {
  const material = React.useMemo(
    () =>
      createMouseDisplaceMaterial({
        ...options,
        color: GOLD_BASE,
        pulseColor: GOLD,
      }),
    [options]
  );

  React.useEffect(() => {
    material.wireframe = true;
    material.transparent = true;
    material.depthWrite = false;
    material.toneMapped = false;
    return () => material.dispose();
  }, [material]);

  return material;
}

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

export function InteractiveModel({
  radius = 0.65,
  strength = 0.4,
  opacity = 0.35,
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
  const baseRef = React.useRef<THREE.Group | null>(null);
  const overlayRef = React.useRef<THREE.Group | null>(null);
  const debugRef = React.useRef<THREE.Mesh | null>(null);

  const ownedSourceGeometryRef = React.useRef<THREE.BufferGeometry | null>(null);
  const [sourceGeometry, setSourceGeometry] = React.useState<THREE.BufferGeometry | null>(null);

  const { rootRef, contentRef, fitScale, refit } = useFitToViewport({
    marginY: 0.1,
    marginX: 0.1,
    fit: "both",
  });

  const overlayOptions = React.useMemo(
    () => ({ radius, strength, opacity, idleStrength }),
    [radius, strength, opacity, idleStrength]
  );
  const overlayMaterial = useOverlayMaterial(overlayOptions);

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

  useFrame((_, delta) => {
    const uniforms = overlayMaterial.uniforms as unknown as MouseDisplaceUniforms;

    if (reducedMotion) {
      uniforms.uStrength.value = 0;
      uniforms.uIdleStrength.value = 0;
      uniforms.uMouse.value.copy(FAR_POINT);
      uniforms.uPulse.value = 0;
      return;
    }

    // Always tick time so mobile still "breathes"
    uniforms.uTime.value += delta;

    // Pulse drives gold intensity on the bust overlay
    let pulse = 0;
    if (inferencePulse) {
      const now = performance.now();
      const elapsed = now - inferencePulse.startTime;
      if (elapsed >= 0 && elapsed <= inferencePulse.durationMs) {
        const p01 = elapsed / inferencePulse.durationMs;
        pulse = pulseEnvelope(p01) * inferencePulse.intensity;
        uniforms.uPulseColor.value.copy(pulseColor(inferencePulse.mode ?? inferenceMode));
      }
    }
    uniforms.uPulse.value = pulse;

    // Touch: no mouse deformation, keep idle breathing
    if (touchOnly) {
      uniforms.uStrength.value = 0;
      uniforms.uIdleStrength.value = idleStrength;
      uniforms.uMouse.value.copy(FAR_POINT);
      return;
    }

    uniforms.uStrength.value = strength;
    uniforms.uIdleStrength.value = idleStrength;

    if (!baseRef.current || !overlayRef.current || !hasPointer) {
      uniforms.uMouse.value.copy(FAR_POINT);
      return;
    }

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(baseRef.current, true);

    if (hits.length > 0) {
      tempPoint.copy(hits[0].point);
      overlayRef.current.worldToLocal(tempPoint);
      uniforms.uMouse.value.copy(tempPoint);
      if (debugRef.current) debugRef.current.position.copy(tempPoint);
    } else {
      uniforms.uMouse.value.copy(FAR_POINT);
    }
  });

  if (!modelUrl) return null;

  return (
    <group ref={rootRef} scale={fitScale * modelScale}>
      <group ref={contentRef}>
        <group ref={baseRef}>
          <React.Suspense fallback={null}>
            <GlbLayer url={modelUrl} material={BASE_DARK} onReady={refit} onGeometryReady={handleGlbGeometry} />
          </React.Suspense>
        </group>

        <group ref={overlayRef}>
          <React.Suspense fallback={null}>
            <GlbLayer url={modelUrl} material={overlayMaterial} />
          </React.Suspense>
        </group>

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
