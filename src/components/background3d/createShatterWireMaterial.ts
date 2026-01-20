import * as THREE from "three";

export const FAR_POINT = new THREE.Vector3(999, 999, 999);

export type ShatterWireMaterialOptions = {
  baseColor?: THREE.ColorRepresentation;
  pulseColor?: THREE.ColorRepresentation;
  opacity?: number;

  // Hover / idle
  radius?: number;
  strength?: number;
  idleStrength?: number;

  // Wire look
  lineWidth?: number;
  lineFeather?: number;

  // Burst + wave
  burstAmp?: number;       // how far faces burst along normal
  waveDuration?: number;   // seconds (envelope length)
  surfaceBias?: number;    // small offset along normal to prevent z-fighting
};

export type ShatterWireUniforms = {
  uMouse: { value: THREE.Vector3 };
  uRadius: { value: number };
  uStrength: { value: number };
  uIdleStrength: { value: number };

  uOpacity: { value: number };
  uBaseColor: { value: THREE.Color };
  uPulseColor: { value: THREE.Color };

  uGlobalPulse: { value: number };

  uTime: { value: number };
  uClickTime: { value: number };

  uBurstAmp: { value: number };
  uWaveDuration: { value: number };

  uLineWidth: { value: number };
  uLineFeather: { value: number };
  uSurfaceBias: { value: number };
};

export function createShatterWireMaterial(
  options: ShatterWireMaterialOptions = {}
) {
  const {
    baseColor = "#cdb57a",
    pulseColor = "#f0d07a",
    opacity = 0.34,

    radius = 0.65,
    strength = 0.35,
    idleStrength = 0.02,

    lineWidth = 0.02,
    lineFeather = 0.01,

    burstAmp = 0.16,
    waveDuration = 0.95,
    surfaceBias = 0.0025,
  } = options;

  const uniforms: ShatterWireUniforms = {
    uMouse: { value: FAR_POINT.clone() },
    uRadius: { value: radius },
    uStrength: { value: strength },
    uIdleStrength: { value: idleStrength },

    uOpacity: { value: opacity },
    uBaseColor: { value: new THREE.Color(baseColor) },
    uPulseColor: { value: new THREE.Color(pulseColor) },

    uGlobalPulse: { value: 0 },

    uTime: { value: 0 },
    uClickTime: { value: -9999 },

    uBurstAmp: { value: burstAmp },
    uWaveDuration: { value: waveDuration },

    uLineWidth: { value: lineWidth },
    uLineFeather: { value: lineFeather },
    uSurfaceBias: { value: surfaceBias },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,

    vertexShader: /* glsl */ `
      uniform vec3 uMouse;
      uniform float uRadius;
      uniform float uStrength;
      uniform float uIdleStrength;

      uniform float uTime;
      uniform float uClickTime;
      uniform float uBurstAmp;
      uniform float uWaveDuration;
      uniform float uSurfaceBias;

      attribute vec3 aBary;
      attribute vec3 aFaceNormal;
      attribute float aDelay;
      attribute float aBurstW;

      varying vec3 vBary;
      varying float vHover;
      varying float vWave;

      float sat(float x) { return clamp(x, 0.0, 1.0); }

      float env(float p01) {
        float t = sat(p01);
        float attack = sat(t / 0.18);
        float decayT = max((t - 0.18) / 0.82, 0.0);
        float decay = 1.0 - decayT * decayT;
        return attack * decay;
      }

      void main() {
        vec3 n = normalize(aFaceNormal);
        vec3 pos = position + n * uSurfaceBias;

        float d = distance(pos, uMouse);
        float hover = smoothstep(uRadius, 0.0, d);

        float idle = uIdleStrength * sin(uTime + position.x * 3.0 + position.y * 4.0);

        float wave = 0.0;
        float burst = 0.0;

        float t = (uTime - uClickTime) - aDelay; // seconds since this face was reached
        if (t > 0.0) {
          float p01 = sat(t / max(uWaveDuration, 0.001));
          wave = env(p01) * aBurstW;

          // Snappier burst than the wave envelope
          float a = smoothstep(0.0, 0.05, t);
          float dd = 1.0 - smoothstep(0.14, 0.55, t);
          burst = a * dd * aBurstW;
        }

        pos += n * (uStrength * hover + idle + uBurstAmp * burst);

        vBary = aBary;
        vHover = hover;
        vWave = wave;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,

    fragmentShader: /* glsl */ `
      uniform vec3 uBaseColor;
      uniform vec3 uPulseColor;
      uniform float uOpacity;
      uniform float uGlobalPulse;

      uniform float uLineWidth;
      uniform float uLineFeather;

      varying vec3 vBary;
      varying float vHover;
      varying float vWave;

      float sat(float x) { return clamp(x, 0.0, 1.0); }

      void main() {
        float edge = min(min(vBary.x, vBary.y), vBary.z);
        float line = 1.0 - smoothstep(uLineWidth, uLineWidth + uLineFeather, edge);

        float pulse = sat(uGlobalPulse + vWave);
        vec3 color = mix(uBaseColor, uPulseColor, pulse);

        float alpha = uOpacity * line * (0.22 + 0.78 * vHover);
        alpha *= (0.70 + 0.95 * pulse);

        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;

  return material;
}
