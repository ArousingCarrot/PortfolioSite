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
import type {
  InferencePulseMode,
  InferencePulseState,
} from "./BackgroundEffectsProvider";
// Minimal GLTF type to avoid depending on three/examples typings
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
  // Returns a matrix that transforms from source's world space into target's local space:
  // targetLocal = inverse(targetWorld) * sourceWorld
  const invTarget = new THREE.Matrix4().copy(targetWorld).invert();
  return new THREE.Matrix4().multiplyMatrices(invTarget, sourceWorld);
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
    () => createMouseDisplaceMaterial(options),
    [options]
  );

  React.useEffect(() => {
    material.wireframe = true;
    material.transparent = true;
    material.depthWrite = false;
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

    const mesh = obj; // MeshWithGeom
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

  // scene.updateWorldMatrix(true, true) already updated children, but keeping this is fine:
  candidate.updateWorldMatrix(true, false);
  onGeometryReady?.(candidate.geometry, candidate.matrixWorld.clone());
}, [scene, material, onReady, onGeometryReady]);

  return <primitive object={scene} />;
}

export function InteractiveModel({
  radius = 0.65,
  strength = 0.4,
  opacity = 0.45,
  idleStrength = 0.02,
  modelScale = 1,
  modelUrl,
  reducedMotion = false,
  touchOnly = false,
  hasPointer = true,
  debug = false,
  inferencePulse = null,
  inferenceMode = "ai",
  inferenceBaseOpacity = 0.05,
}: InteractiveModelProps) {
  const baseRef = React.useRef<THREE.Group | null>(null);
  const overlayRef = React.useRef<THREE.Group | null>(null);
  const debugRef = React.useRef<THREE.Mesh | null>(null);

  const ownedSourceGeometryRef = React.useRef<THREE.BufferGeometry | null>(null);
  const [sourceGeometry, setSourceGeometry] =
    React.useState<THREE.BufferGeometry | null>(null);

  const { rootRef, contentRef, fitScale, refit } = useFitToViewport({
    marginY: 0.1,
    marginX: 0.1,
    fit: "both",
  });

  const overlayOptions = React.useMemo(
    () => ({
      radius,
      strength,
      opacity,
      idleStrength,
    }),
    [radius, strength, opacity, idleStrength]
  );

  const overlayMaterial = useOverlayMaterial(overlayOptions);

  const { raycaster, pointer, camera } = useThree();
  const tempPoint = React.useMemo(() => new THREE.Vector3(), []);

  React.useEffect(() => {
    const uniforms = overlayMaterial.uniforms as MouseDisplaceUniforms;
    uniforms.uRadius.value = radius;
    uniforms.uOpacity.value = opacity;
  }, [overlayMaterial, radius, opacity]);

  useFrame((_, delta) => {
    const uniforms = overlayMaterial.uniforms as MouseDisplaceUniforms;
    const disableMotion = reducedMotion || touchOnly;

    if (disableMotion) {
      uniforms.uStrength.value = 0;
      uniforms.uIdleStrength.value = 0;
      uniforms.uMouse.value.copy(FAR_POINT);
      return;
    }

    uniforms.uTime.value += delta;
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

  const geometryBase = React.useMemo(
    () => new THREE.IcosahedronGeometry(1, 2),
    []
  );
  const geometryOverlay = React.useMemo(
    () => new THREE.IcosahedronGeometry(1.01, 4),
    []
  );

  const hasModel = Boolean(modelUrl);

  const handleGlbGeometry = React.useCallback(
    (geometry: THREE.BufferGeometry, meshWorld: THREE.Matrix4) => {
      // Dispose previous owned clone
      if (ownedSourceGeometryRef.current) {
        ownedSourceGeometryRef.current.dispose();
        ownedSourceGeometryRef.current = null;
      }

      const content = contentRef.current;
      const cloned = geometry.clone();

      if (content) {
        // Bake the mesh's world transform into content-local space
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
    if (!hasModel) {
      // fallback mode (we do not own geometryBase)
      if (ownedSourceGeometryRef.current) {
        ownedSourceGeometryRef.current.dispose();
        ownedSourceGeometryRef.current = null;
      }
      setSourceGeometry(geometryBase);
      return;
    }

    setSourceGeometry(null);
  }, [hasModel, modelUrl, geometryBase]);

  React.useEffect(() => {
    return () => {
      if (ownedSourceGeometryRef.current) {
        ownedSourceGeometryRef.current.dispose();
        ownedSourceGeometryRef.current = null;
      }
    };
  }, []);

  return (
    <group ref={rootRef} scale={fitScale * modelScale}>
      <group ref={contentRef}>
        <group ref={baseRef}>
          {hasModel && modelUrl ? (
            <GlbLayer
              url={modelUrl}
              material={baseMaterial}
              onReady={refit}
              onGeometryReady={handleGlbGeometry}
            />
          ) : (
            <mesh geometry={geometryBase} material={baseMaterial} />
          )}
        </group>

        <group ref={overlayRef}>
          {hasModel && modelUrl ? (
            <GlbLayer url={modelUrl} material={overlayMaterial} />
          ) : (
            <mesh geometry={geometryOverlay} material={overlayMaterial} />
          )}
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
