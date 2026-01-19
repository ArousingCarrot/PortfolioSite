"use client";

import * as React from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

export type UseFitToViewportOptions = {
  /** 0.1 = 10% margin on top and bottom */
  marginY?: number;
  /** 0.1 = 10% margin on left and right */
  marginX?: number;
  /** Default "both" ensures it fits vertically and horizontally */
  fit?: "both" | "vertical" | "horizontal";
};

export function useFitToViewport(options: UseFitToViewportOptions = {}) {
  const { marginY = 0.1, marginX = 0.1, fit = "both" } = options;

  // NOTE: strict TS requires refs to include null in the type.
  const rootRef = React.useRef<THREE.Group | null>(null);
  const contentRef = React.useRef<THREE.Group | null>(null);

  const { camera, size, invalidate } = useThree();
  const [fitScale, setFitScale] = React.useState(1);

  const refit = React.useCallback(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    const cam = camera as THREE.PerspectiveCamera;

    if (!root || !content) return;
    if (!("fov" in cam)) return;

    // Ensure we measure the *unscaled* content
    const prevRootScale = root.scale.clone();
    root.scale.set(1, 1, 1);
    root.updateWorldMatrix(true, true);

    // Reset content position before measuring so we don't accumulate offsets
    content.position.set(0, 0, 0);
    content.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(content);
    const boxSize = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(boxSize);
    box.getCenter(center);

    if (
      !isFinite(boxSize.x) ||
      !isFinite(boxSize.y) ||
      boxSize.x <= 0 ||
      boxSize.y <= 0
    ) {
      root.scale.copy(prevRootScale);
      root.updateWorldMatrix(true, true);
      return;
    }

    // Center content at origin
    content.position.sub(center);
    content.updateWorldMatrix(true, true);

    // Use distance from camera to the root's world position
    const rootWorldPos = new THREE.Vector3();
    root.getWorldPosition(rootWorldPos);
    const distance = cam.position.distanceTo(rootWorldPos);

    const vFov = THREE.MathUtils.degToRad(cam.fov);
    const aspect = cam.aspect || size.width / size.height;

    const viewHeight = 2 * distance * Math.tan(vFov / 2);
    const viewWidth = viewHeight * aspect;

    const targetH = viewHeight * (1 - 2 * marginY);
    const targetW = viewWidth * (1 - 2 * marginX);

    const sH = targetH / boxSize.y;
    const sW = targetW / boxSize.x;

    const nextScale =
      fit === "vertical" ? sH : fit === "horizontal" ? sW : Math.min(sH, sW);

    // Restore root scale (React will apply fitScale on next render)
    root.scale.copy(prevRootScale);
    root.updateWorldMatrix(true, true);

    if (isFinite(nextScale) && nextScale > 0) {
      setFitScale(nextScale);
      // Useful when Canvas is running in frameloop="demand".
      invalidate();
    }
  }, [camera, invalidate, marginX, marginY, fit, size.width, size.height]);

  // Refit on viewport resize / camera changes
  React.useLayoutEffect(() => {
    refit();
  }, [refit, size.width, size.height]);

  return { rootRef, contentRef, fitScale, refit };
}
