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
}: {
  url: string;
  material: THREE.Material;
  onReady?: () => void;
}) {
  const gltf = useGLTF(url);
  const scene = React.useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  React.useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = material;
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });

    onReady?.();
  }, [scene, material, onReady]);

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
}: InteractiveModelProps) {
  const baseRef = React.useRef<THREE.Group>(null);
  const overlayRef = React.useRef<THREE.Group>(null);
  const debugRef = React.useRef<THREE.Mesh>(null);

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

return (
  <group ref={rootRef} scale={fitScale * modelScale}>
    <group ref={contentRef}>
      <group ref={baseRef}>
        {hasModel && modelUrl ? (
          <GlbLayer url={modelUrl} material={baseMaterial} onReady={refit} />
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