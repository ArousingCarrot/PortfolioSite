"use client";

import * as React from "react";
import * as THREE from "three";
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

const baseMaterial = new THREE.MeshStandardMaterial({
  color: "#14141c",
  metalness: 0.15,
  roughness: 0.85,
  emissive: "#050508",
  emissiveIntensity: 0.6,
});

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

    return () => {
      material.dispose();
    };
  }, [material]);

  return material;
}

function GlbLayer({
  url,
  material,
  onReady,
  onGeometryReady,
}: {
  url: string;
  material: THREE.Material;
  onReady?: () => void;
  onGeometryReady?: (geometry: THREE.BufferGeometry) => void;
}) {
  const gltf = useGLTF(url);
  const scene = React.useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  React.useEffect(() => {
    let candidateMesh: THREE.Mesh | null = null;

    // Reuse vectors to avoid per-traverse allocations
    const candidateSize = new THREE.Vector3();
    const meshSize = new THREE.Vector3();

    scene.traverse((child) => {
      // Avoid relying on instanceof (can be brittle across mixed three builds),
      // and avoid TS narrowing issues by using runtime flags.
      const anyChild = child as unknown as {
        isMesh?: boolean;
        material?: unknown;
        castShadow?: boolean;
        receiveShadow?: boolean;
        geometry?: unknown;
      };

      if (!anyChild.isMesh) return;

      // Apply material overrides safely
      (anyChild.material as THREE.Material) = material;
      anyChild.castShadow = false;
      anyChild.receiveShadow = false;

      const mesh = child as unknown as THREE.Mesh;

      if (!candidateMesh) {
        candidateMesh = mesh;
        return;
      }

      // Choose the largest mesh by bounds as representative geometry source
      const candidateBox = new THREE.Box3().setFromObject(candidateMesh);
      const childBox = new THREE.Box3().setFromObject(mesh);

      const childLenSq = childBox.getSize(meshSize).lengthSq();
      const candidateLenSq = candidateBox.getSize(candidateSize).lengthSq();

      if (childLenSq > candidateLenSq) {
        candidateMesh = mesh;
      }
    });

    onReady?.();

    // Don’t let TS narrowing dictate this; assert and verify at runtime.
    if (candidateMesh) {
      const geom = (candidateMesh as THREE.Mesh).geometry as unknown;

      // Ensure it’s a BufferGeometry before handing it to the overlay builder.
      const isBufferGeometry =
        typeof geom === "object" &&
        geom !== null &&
        // three sets isBufferGeometry on BufferGeometry instances
        (geom as { isBufferGeometry?: boolean }).isBufferGeometry === true;

      if (isBufferGeometry) {
        onGeometryReady?.(geom as THREE.BufferGeometry);
      }
    }
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

      if (debugRef.current) {
        debugRef.current.position.copy(tempPoint);
      }
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

  React.useEffect(() => {
    if (!hasModel) {
      setSourceGeometry(geometryBase);
      return;
    }
    // GLB mode: wait for GlbLayer to provide geometry
    setSourceGeometry(null);
  }, [hasModel, modelUrl, geometryBase]);

  return (
    <group ref={rootRef} scale={fitScale * modelScale}>
      <group ref={contentRef}>
        <group ref={baseRef}>
          {hasModel && modelUrl ? (
            <GlbLayer
              url={modelUrl}
              material={baseMaterial}
              onReady={refit}
              onGeometryReady={setSourceGeometry}
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
            mode={inferenceMode}
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