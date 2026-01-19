'use client';
import { motion } from "framer-motion";

// --- The whole hero section with overlayed UI ---
export default function PortfolioHero() {
  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
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
