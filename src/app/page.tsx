'use client';
import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { shaderMaterial, Html } from "@react-three/drei";
import { motion } from "framer-motion";

// === Custom shader that "stretches" vertices near a hit point ===
// uHit is in the mesh's local space. We displace along normals with a smooth falloff.
const StretchMat = shaderMaterial(
  {
    uTime: 0,
    uHit: new THREE.Vector3(999, 999, 999), // far away initially
    uRadius: 0.6,
    uStrength: 0.45,
    uColor: new THREE.Color(0xefd9a7), // soft gold
    uAlpha: 0.45,
  },
  // vertex shader
  /* glsl */ `
    uniform float uTime;
    uniform vec3  uHit;
    uniform float uRadius;
    uniform float uStrength;
    varying vec3 vNormal;
    varying vec3 vWorldPos;

    void main() {
      vNormal = normal;
      vec3 pos = position;
      // distance in local space to hit point
      float d = distance(pos, uHit);
      // smooth falloff so it eases in/out
      float infl = smoothstep(uRadius, 0.0, d);
      // displace outwards along normal
      pos += normalize(normal) * infl * uStrength;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // fragment shader
  /* glsl */ `
    uniform vec3  uColor;
    uniform float uAlpha;
    varying vec3 vNormal;

    void main(){
      // wireframe-like look via low alpha; rely on material.wireframe=true from React side
      gl_FragColor = vec4(uColor, uAlpha);
      #ifdef GL_OES_standard_derivatives
        // leave room for future edge glow if desired
      #endif
    }
  `
);

// Register material as <stretchMat />
// @ts-ignore
import { extend } from "@react-three/fiber";
extend({ StretchMat });

function StretchyWire() {
  const meshRef = React.useRef<THREE.Mesh>(null!);
  const matRef = React.useRef<any>(null!);

  // animate subtle breathing when idle
  useFrame((state, dt) => {
    if (matRef.current) {
      matRef.current.uTime += dt;
      // gently pull the hit point back toward "far away" so the surface relaxes when not hovered
      const hit = matRef.current.uHit as THREE.Vector3;
      hit.lerp(new THREE.Vector3(999, 999, 999), 0.06);
    }
  });

  const onMove = (e: any) => {
    if (!meshRef.current || !matRef.current) return;
    // Intersection point in world space
    const world = e.point.clone();
    // Convert to the mesh's local space for stable distances
    const local = meshRef.current.worldToLocal(world);
    (matRef.current.uHit as THREE.Vector3).copy(local);
  };

  return (
    <group>
      {/* Base matte body (dark) */}
      <mesh scale={1.2}>
        <icosahedronGeometry args={[1, 8]} />
        <meshStandardMaterial color="#0b0b0d" metalness={0.1} roughness={0.95} />
      </mesh>

      {/* Interactive wire overlay */}
      <mesh
        ref={meshRef}
        scale={1.2}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerOver={onMove}
        onPointerOut={() => {
          if (matRef.current) (matRef.current.uHit as THREE.Vector3).set(999, 999, 999);
        }}
      >
        {/* Higher detail for a nice mesh */}
        <icosahedronGeometry args={[1.01, 64]} />
        {/* @ts-ignore - custom material registered above */}
        <stretchMat ref={matRef} wireframe transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 2]} intensity={1.2} />
      <directionalLight position={[-3, -2, -2]} intensity={0.6} />
    </>
  );
}

// --- The whole hero section with overlayed UI ---
export default function PortfolioHero() {
  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* 3D background */}
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 3.6], fov: 55 }} dpr={[1, 2]}>
          <Lights />
          <StretchyWire />
        </Canvas>
      </div>

      {/* subtle vignette/gradient overlay for contrast */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

      {/* Content */}
      <main className="relative z-10 container mx-auto px-6 py-16 md:py-24">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl"
        >
          <p className="tracking-widest text-xs uppercase text-neutral-400">Portfolio</p>
          <h1 className="mt-3 text-4xl md:text-6xl font-semibold leading-tight">
            Samuel J. Baker IV
          </h1>
          <p className="mt-4 text-lg md:text-xl text-neutral-300">
            Game-engine tinkerer, systems-minded software engineer, UVA CS + EBM. I build deterministic, seed-driven procedural worlds and sleek, performant UIs.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/Samuel_Baker_Resume.pdf"
              className="rounded-2xl border border-yellow-300/50 bg-yellow-300/10 px-5 py-2 text-yellow-200 hover:bg-yellow-300/20 transition"
            >
              View Résumé
            </a>
            <a
              href="#projects"
              className="rounded-2xl border border-neutral-700 bg-neutral-900/60 px-5 py-2 hover:bg-neutral-800 transition"
            >
              Explore Projects
            </a>
            <a
              href="mailto:hello@samueljbaker.dev"
              className="rounded-2xl border border-neutral-700 px-5 py-2 hover:bg-neutral-800 transition"
            >
              Contact
            </a>
          </div>
        </motion.header>

        <section id="projects" className="mt-24 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: "Roomination — Procedural Labyrinth", blurb: "C++/Unity hybrid; ECS, FNV-hash seeds, relic system, CRT shaders." },
            { title: "Beacon — Modular RTS/Tower Defense", blurb: "Seed-driven planets & relics; ImGui docking; deterministic RNG pipeline." },
            { title: "APMA 3150 Data Viz", blurb: "R + Python: robust stats, QQ-plots, spline smoothing, reproducible Rmds." },
          ].map((p, i) => (
            <motion.article
              key={p.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 backdrop-blur-sm hover:bg-neutral-900/70"
            >
              <h3 className="text-lg font-medium">{p.title}</h3>
              <p className="mt-2 text-sm text-neutral-400">{p.blurb}</p>
              <a href="#" className="mt-4 inline-block text-sm text-yellow-200/90 hover:text-yellow-200">Case study →</a>
            </motion.article>
          ))}
        </section>
      </main>

      <footer className="relative z-10 mt-16 border-t border-neutral-900/80 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
        <div className="container mx-auto px-6 py-6 text-sm text-neutral-500 flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Samuel J. Baker IV</span>
          <span className="text-neutral-600">samueljbaker.dev</span>
        </div>
      </footer>
    </div>
  );
}
