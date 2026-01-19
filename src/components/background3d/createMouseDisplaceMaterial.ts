import * as THREE from "three";

export type MouseDisplaceMaterialOptions = {
  color?: THREE.ColorRepresentation;
  opacity?: number;
  radius?: number;
  strength?: number;
  idleStrength?: number;
};

export type MouseDisplaceUniforms = {
  uMouse: { value: THREE.Vector3 };
  uRadius: { value: number };
  uStrength: { value: number };
  uOpacity: { value: number };
  uColor: { value: THREE.Color };
  uTime: { value: number };
  uIdleStrength: { value: number };
};

export const FAR_POINT = new THREE.Vector3(999, 999, 999);

export function createMouseDisplaceMaterial(
  options: MouseDisplaceMaterialOptions = {}
) {
  const {
    color = "#f6e7c9",
    opacity = 0.45,
    radius = 0.6,
    strength = 0.35,
    idleStrength = 0.02,
  } = options;

  const uniforms: MouseDisplaceUniforms = {
    uMouse: { value: FAR_POINT.clone() },
    uRadius: { value: radius },
    uStrength: { value: strength },
    uOpacity: { value: opacity },
    uColor: { value: new THREE.Color(color) },
    uTime: { value: 0 },
    uIdleStrength: { value: idleStrength },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform vec3 uMouse;
      uniform float uRadius;
      uniform float uStrength;
      uniform float uTime;
      uniform float uIdleStrength;

      varying float vInfluence;

      void main() {
        vec3 pos = position;
        float d = distance(pos, uMouse);
        float influence = smoothstep(uRadius, 0.0, d);
        float idle = uIdleStrength * sin(uTime + position.x * 3.0 + position.y * 4.0);

        pos += normalize(normal) * (uStrength * influence + idle);
        vInfluence = influence;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vInfluence;

      void main() {
        float alpha = uOpacity * (0.15 + 0.85 * vInfluence);
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });

  return material;
}