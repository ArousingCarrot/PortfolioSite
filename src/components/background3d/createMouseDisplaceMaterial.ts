import * as THREE from "three";

export type MouseDisplaceMaterialOptions = {
  color?: THREE.ColorRepresentation;
  pulseColor?: THREE.ColorRepresentation;
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
  uPulseColor: { value: THREE.Color };
  uPulse: { value: number };
  uTime: { value: number };
  uIdleStrength: { value: number };
};

export const FAR_POINT = new THREE.Vector3(999, 999, 999);

export function createMouseDisplaceMaterial(
  options: MouseDisplaceMaterialOptions = {}
) {
  const {
    color = "#cdb57a",      // warm gold baseline
    pulseColor = "#f0d07a", // brighter gold for pulse
    opacity = 0.35,
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
    uPulseColor: { value: new THREE.Color(pulseColor) },
    uPulse: { value: 0 },
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
      uniform vec3 uPulseColor;
      uniform float uOpacity;
      uniform float uPulse;
      varying float vInfluence;

      float sat(float x) { return clamp(x, 0.0, 1.0); }

      void main() {
        float base = uOpacity * (0.18 + 0.82 * vInfluence);
        float pulseBoost = 0.55 + 0.95 * sat(uPulse);
        float alpha = base * pulseBoost;

        vec3 color = mix(uColor, uPulseColor, sat(uPulse));
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  return material;
}
