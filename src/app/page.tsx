"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { now } from "../content/now";

type Social = {
  name: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
};

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M12 0.297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.305 3.492.998.108-.776.418-1.305.762-1.605-2.665-.305-5.466-1.333-5.466-5.93 0-1.31.469-2.381 1.235-3.221-.123-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.241 2.873.118 3.176.77.84 1.233 1.911 1.233 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.218.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12z"
      />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.03-1.85-3.03-1.85 0-2.13 1.44-2.13 2.93v5.67H9.37V9h3.41v1.56h.05c.47-.9 1.62-1.85 3.34-1.85 3.57 0 4.23 2.35 4.23 5.41v6.33zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.11 20.45H3.56V9h3.55v11.45z"
      />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M6 2h8l4 4v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V7h3.5L14 3.5zM8 11h8v1.5H8V11zm0 3h8v1.5H8V14zm0 3h6v1.5H8V17z"
      />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 3.2-8 5.1-8-5.1V6l8 5.1L20 6v1.2z"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z"
      />
      <path
        fill="currentColor"
        d="M5 5h6v2H7v10h10v-4h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
      />
    </svg>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-800 bg-neutral-900/40 px-3 py-1 text-xs text-neutral-300">
      {children}
    </span>
  );
}

type Project = {
  title: string;
  timeframe: string;
  location?: string;
  tags: string[];
  highlights: string[];
  links?: Array<{ label: string; href: string; external?: boolean; muted?: boolean }>;
  note?: string;
};

const SOCIALS: Social[] = [
  { name: "LinkedIn", href: "https://www.linkedin.com/in/samuel-j-baker-iv/", Icon: LinkedInIcon },
  { name: "GitHub", href: "https://github.com/ArousingCarrot", Icon: GitHubIcon },
  { name: "Email", href: "mailto:hello@samueljbaker.dev", Icon: MailIcon },
];

const PROJECTS: Project[] = [
  {
    title: "Entity Component System Game Engine",
    timeframe: "Jun 2025 to Present",
    location: "Charlottesville, VA",
    tags: ["C++", "ECS", "Performance", "Tools", "OpenGL", "ImGui"],
    highlights: [
      "Built a C++ ECS engine with an editor-style UI, scene renderer, asset pipeline, and diagnostics.",
      "Optimized ECS storage from hash maps to dense arrays: add/remove (100k entities) 99.8 ms to 11.8 ms, and system update 39.8 ms to 6.93 ms per frame.",
      "Benchmarked hot paths: 100M sequential GetComponent lookups in 2.78 s (27.8 ns per access) and multi-million polygon scenes at interactive frame rates.",
    ],
    links: [{ label: "Repo coming soon", href: "#", muted: true }],
    note: "Private repo right now. If you want to see code, reach out and I can share a build or walkthrough.",
  },
  {
    title: "Homelab and Local LLM Tooling",
    timeframe: "Jun 2025",
    location: "Charlottesville, VA",
    tags: ["Python", "Hugging Face", "Ollama", "Linux", "Systems"],
    highlights: [
      "Repurposed a home server (Ryzen 7 3600X, GTX 1660S, 32 GB RAM) to host game servers and run local LLM workflows.",
      "Built a custom UI for continual tokenization and model interaction to support local fine-tuning and iterative testing.",
    ],
  },
  {
    title: "Eggs by the Dozen",
    timeframe: "Apr 2024",
    location: "University of Virginia",
    tags: ["Computer Vision", "OpenCV", "Express.js", "Docker"],
    highlights: [
      "Designed a low-cost computer vision workflow for McMaster slide egg counting to reduce time and cost of parasite monitoring.",
      "Built a web prototype (HTML, CSS, JavaScript) with an Express.js server and an OpenCV feature-based detection pipeline.",
      "Containerized the application with Docker and deployed it for end-to-end testing from upload to results.",
    ],
    links: [{ label: "Read report (PDF)", href: "/papers/EggsByTheDozen.pdf" }],
  },
  {
    title: "Agentic AI RPG Arbiter",
    timeframe: "Aug 2025",
    location: "Charlottesville, VA",
    tags: ["LLM", "Agentic Systems", "Game Design", "State"],
    highlights: [
      "Built a chat-driven dungeon arbiter that maps player dialogue to state flags and event triggers for branching encounters.",
      "Implemented lightweight dialogue and state persistence to support deeper text-adventure interactions inside an RPG loop.",
    ],
    links: [{ label: "Write-up coming soon", href: "#", muted: true }],
  },
  {
    title: "Mycorrhizal Fungi Inoculation in Soybeans",
    timeframe: "Feb 2023",
    location: "Chesapeake Bay Governor’s School Symposium",
    tags: ["Research", "Experiment Design", "Statistics"],
    highlights: [
      "Ran a controlled inoculation study on soybeans (n=60, 6 groups, 2 trials) under 70%, 100%, and 130% water-holding capacity over 7 to 8 weeks.",
      "Found significant differences in shoot dry mass and chlorophyll, and presented findings at the Chesapeake Bay Governor’s School symposium.",
    ],
    links: [{ label: "Read paper (PDF)", href: "/papers/SeniorProject.pdf" }],
  },
];

type Metric = { label: string; value: string; detail: string };

const METRICS: Metric[] = [
  { label: "ECS add/remove", value: "8.6x faster", detail: "100k entities: 99.8 ms to 11.8 ms" },
  { label: "System update", value: "5.7x faster", detail: "39.8 ms to 6.93 ms per frame" },
  { label: "Component lookups", value: "100M in 2.78 s", detail: "27.8 ns per access" },
];

const NOW_READING = now.reading;
const NOW_LISTENING_FALLBACK = "Last.fm now playing unavailable.";

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <p className="tracking-widest text-xs uppercase text-neutral-400">{eyebrow}</p>
      <h2 className="mt-2 text-2xl md:text-3xl font-semibold">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function NowListening() {
  const [state, setState] = React.useState<{
    status: "idle" | "loading" | "ready" | "error";
    text: string;
    href?: string;
    imageUrl?: string;
    isPlaying?: boolean;
  }>({
    status: "idle",
    text: NOW_LISTENING_FALLBACK,
  });

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setState({ status: "loading", text: "Loading now playing…" });
        const res = await fetch("/api/now-playing", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          isPlaying?: boolean;
          title?: string;
          artist?: string;
          trackUrl?: string;
          imageUrl?: string;
        };

        if (cancelled) return;

        if (!data?.isPlaying || !data?.title) {
          setState({ status: "ready", text: "Not playing right now.", isPlaying: false });
          return;
        }

        const text = data.artist ? `${data.title} by ${data.artist}` : data.title;
        setState({
          status: "ready",
          text,
          href: data.trackUrl,
          imageUrl: data.imageUrl,
          isPlaying: true,
        });
      } catch {
        if (!cancelled) setState({ status: "error", text: NOW_LISTENING_FALLBACK });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-2 flex items-start gap-3 text-sm text-neutral-300">
      <div className="h-12 w-12 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/40">
        {state.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.imageUrl}
            alt="Album art"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>

      <div className="min-w-0">
{state.isPlaying ? (
  <div className="mb-1 flex items-center gap-2 text-xs text-neutral-400">
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
    </span>
    <span className="uppercase tracking-widest">Live</span>
  </div>
) : null}

<div className="min-w-0">
  {state.href ? (
    <a
      href={state.href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-yellow-200/90 hover:text-yellow-200"
      title="Open in Last.fm"
    >
      <span className="truncate">{state.text}</span>
      <ExternalLinkIcon className="h-4 w-4" />
    </a>
  ) : (
    <span className={classNames(state.status === "loading" && "text-neutral-400")}>
      {state.text}
    </span>
  )}
</div>
      </div>
    </div>
  );
}

function ResumePreview() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-6">
      <p className="text-sm text-neutral-300">
        Quick preview. If the embed does not load in your browser, use the open or download buttons.
      </p>

      <div className="mt-4 hidden md:block">
        <div className="aspect-[8.5/11] w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/50">
          <iframe title="Resume preview" src="/Samuel_Baker_Resume.pdf" className="h-full w-full" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href="/Samuel_Baker_Resume.pdf"
          className="inline-flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 px-5 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60 transition"
        >
          <FileIcon className="h-4 w-4" />
          <span>Open resume</span>
        </a>

        <a
          href="/Samuel_Baker_Resume.pdf"
          download
          className="inline-flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 px-5 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60 transition"
        >
          <span>Download PDF</span>
        </a>
      </div>
    </div>
  );
}

function coverUrlFromIsbn(isbn13: string) {
  // Open Library Covers API (append ?default=false to get 404 if missing)
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn13)}-L.jpg?default=false`;
}

export default function Page() {
  return (
    <div className="relative min-h-screen bg-transparent text-neutral-100 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/75" />

      <div className="sticky top-0 z-30 border-b border-neutral-900/70 bg-neutral-950/50 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/40">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <a href="#top" className="font-medium text-sm md:text-base">
            SJB
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-300">
            <a href="#projects" className="hover:text-neutral-100 transition">
              Projects
            </a>
            <a href="#skills" className="hover:text-neutral-100 transition">
              Skills
            </a>
            <a href="#resume" className="hover:text-neutral-100 transition">
              Resume
            </a>
            <a href="#now" className="hover:text-neutral-100 transition">
              Now
            </a>
            <a href="#contact" className="hover:text-neutral-100 transition">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="/Samuel_Baker_Resume.pdf"
              className="inline-flex items-center gap-2 rounded-2xl border border-yellow-300/40 bg-yellow-300/10 px-4 py-2 text-sm text-yellow-100 hover:bg-yellow-300/15 transition"
              title="Open resume"
            >
              <FileIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Resume</span>
            </a>

            <a
              href="/Samuel_Baker_Resume.pdf"
              download
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60 transition"
              title="Download resume PDF"
            >
              <span className="hidden sm:inline">Download</span>
              <span className="sm:hidden">DL</span>
            </a>

            <div className="ml-1 flex items-center gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={s.href.startsWith("http") ? "noreferrer" : undefined}
                  className="inline-flex items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/30 p-2 text-neutral-200 hover:bg-neutral-900/60 transition"
                  aria-label={s.name}
                  title={s.name}
                >
                  <s.Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main id="top" className="relative z-10 container mx-auto px-6 py-14 md:py-20">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl"
        >
          <p className="tracking-widest text-xs uppercase text-neutral-400">Computer Science (AI) at UVA</p>

          <h1 className="mt-3 text-4xl md:text-6xl font-semibold leading-tight">
            Samuel J. Baker IV
          </h1>

          <p className="mt-5 text-lg md:text-xl text-neutral-300 leading-relaxed">
            I am a third-year CS student on the AI focal path at the University of Virginia, originally from Heathsville, Virginia.
            I like building practical AI systems that feel usable, fast, and honest about constraints. That includes computer vision
            pipelines, local LLM workflows, and agentic game systems. I also spend a lot of time in C++ optimizing hot paths and tooling,
            because I care about performance you can measure.
          </p>

          <p className="mt-4 text-base text-neutral-400 leading-relaxed">
            Outside of code, I care about game design, weightlifting, film, music (guitar), and reading. If you want a quick snapshot
            of what I am working on, scroll to the Now section.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#projects"
              className="rounded-2xl border border-yellow-300/40 bg-yellow-300/10 px-5 py-2 text-yellow-100 hover:bg-yellow-300/15 transition"
            >
              Explore projects
            </a>
            <a
              href="/Samuel_Baker_Resume.pdf"
              className="rounded-2xl border border-neutral-800 bg-neutral-900/40 px-5 py-2 hover:bg-neutral-900/60 transition"
            >
              Open resume
            </a>
            <a
              href="mailto:hello@samueljbaker.dev"
              className="rounded-2xl border border-neutral-800 px-5 py-2 hover:bg-neutral-900/60 transition"
            >
              Email me
            </a>
          </div>
        </motion.header>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-5 backdrop-blur-sm"
            >
              <p className="text-xs uppercase tracking-widest text-neutral-400">{m.label}</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-100">{m.value}</p>
              <p className="mt-2 text-sm text-neutral-400">{m.detail}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-16">
          <Section id="projects" eyebrow="Work" title="Projects">
            <div className="grid gap-6 lg:grid-cols-2">
              {PROJECTS.map((p, i) => (
                <motion.article
                  key={p.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                  className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-6 backdrop-blur-sm hover:bg-neutral-900/55 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg md:text-xl font-medium">{p.title}</h3>
                      <p className="mt-1 text-sm text-neutral-400">
                        {p.timeframe}
                        {p.location ? ` · ${p.location}` : ""}
                      </p>
                    </div>
                    <div className="hidden sm:block text-right text-xs text-neutral-500">
                      {p.tags.slice(0, 3).join(" · ")}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {p.tags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>

                  <ul className="mt-4 space-y-2 text-sm text-neutral-300">
                    {p.highlights.map((h) => (
                      <li key={h} className="flex gap-3">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-yellow-200/80 flex-none" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>

                  {p.note ? <p className="mt-4 text-sm text-neutral-400">{p.note}</p> : null}

                  {p.links?.length ? (
                    <div className="mt-5 flex flex-wrap gap-3">
                      {p.links.map((l) => {
                        const disabled = l.muted || l.href === "#";
                        const href = disabled ? "#projects" : l.href;

                        return (
                          <a
                            key={l.label}
                            href={href}
                            target={!disabled && l.href.startsWith("http") ? "_blank" : undefined}
                            rel={!disabled && l.href.startsWith("http") ? "noreferrer" : undefined}
                            className={classNames(
                              "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm transition",
                              disabled
                                ? "border-neutral-800 bg-neutral-950/10 text-neutral-500 cursor-not-allowed"
                                : "border-neutral-800 bg-neutral-900/40 text-neutral-200 hover:bg-neutral-900/60"
                            )}
                            aria-disabled={disabled}
                            onClick={(e) => {
                              if (disabled) e.preventDefault();
                            }}
                          >
                            <span>{l.label}</span>
                            {!disabled && (l.external || l.href.startsWith("http")) ? (
                              <ExternalLinkIcon className="h-4 w-4 opacity-70" />
                            ) : null}
                          </a>
                        );
                      })}
                    </div>
                  ) : null}
                </motion.article>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-900/25 p-6">
              <p className="text-sm text-neutral-300">
                I do not have screenshots yet for a couple of these. I can add quick walkthrough GIFs and short clips as I package repos for public release.
              </p>
            </div>
          </Section>
        </div>

        <div className="mt-16 grid gap-10 lg:grid-cols-2">
          <Section id="skills" eyebrow="Toolkit" title="Skills">
            <div className="grid gap-4">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-5">
                <p className="text-sm font-medium">Languages</p>
                <p className="mt-2 text-sm text-neutral-300">
                  C and C++, Python, SQL, Java, JavaScript and TypeScript, C#, Rust
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-5">
                <p className="text-sm font-medium">AI and ML</p>
                <p className="mt-2 text-sm text-neutral-300">
                  PyTorch, TensorFlow, OpenCV, Hugging Face, Ollama
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-5">
                <p className="text-sm font-medium">Web and Backend</p>
                <p className="mt-2 text-sm text-neutral-300">
                  Node.js, Express, MongoDB
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-5">
                <p className="text-sm font-medium">Systems and Graphics</p>
                <p className="mt-2 text-sm text-neutral-300">
                  Linux, Git, SDL3, OpenGL 3.3 and 4.3, Vulkan 1.3, DirectX 11
                </p>
              </div>
            </div>
          </Section>

          <Section id="education" eyebrow="Background" title="Education">
            <div className="space-y-4">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">
                    University of Virginia, School of Engineering and Applied Science
                  </p>
                  <p className="text-xs text-neutral-500">Expected May 2027</p>
                </div>
                <p className="mt-2 text-sm text-neutral-300">
                  BS in Computer Science (AI focal path), Engineering Business minor
                </p>
                <p className="mt-1 text-sm text-neutral-400">GPA 3.5</p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">Rappahannock Community College</p>
                  <p className="text-xs text-neutral-500">Aug 2019 to May 2023</p>
                </div>
                <p className="mt-2 text-sm text-neutral-300">
                  Associate of Arts and Science, Summa Cum Laude
                </p>
                <p className="mt-1 text-sm text-neutral-400">GPA 4.0</p>
              </div>
            </div>
          </Section>
        </div>

        <div className="mt-16">
          <Section id="resume" eyebrow="Document" title="Resume">
            <ResumePreview />
          </Section>
        </div>

        <div className="mt-16">
          <Section id="now" eyebrow="What am I up to?" title="Now">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-6">
                <p className="text-sm font-medium text-neutral-200">What I am reading</p>
                <div className="mt-4 flex gap-4">
                  <div className="h-20 w-14 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverUrlFromIsbn(NOW_READING.isbn13)}
                      alt={`Cover of ${NOW_READING.title}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm text-neutral-300">
                      <span className="text-neutral-100">{NOW_READING.title}</span>
                      {NOW_READING.author ? ` by ${NOW_READING.author}` : ""}
                    </p>
                    <p className="mt-3 text-sm text-neutral-400">{NOW_READING.note}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-6">
                <p className="text-sm font-medium text-neutral-200">What I am listening to</p>
                <NowListening />
                <p className="mt-3 text-xs text-neutral-500">
  Powered by Last.fm.
                </p>
              </div>
            </div>
          </Section>
        </div>

        <div className="mt-16">
          <Section id="contact" eyebrow="Get in touch" title="Contact">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/35 p-6">
              <p className="text-sm text-neutral-300">
                Best way to reach me is email. LinkedIn also works.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="mailto:hello@samueljbaker.dev"
                  className="inline-flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 px-5 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60 transition"
                >
                  <MailIcon className="h-4 w-4" />
                  <span>Email</span>
                </a>

                <a
                  href="https://www.linkedin.com/in/samuel-j-baker-iv/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 px-5 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60 transition"
                >
                  <LinkedInIcon className="h-4 w-4" />
                  <span>LinkedIn</span>
                  <ExternalLinkIcon className="h-4 w-4 opacity-70" />
                </a>
              </div>
            </div>
          </Section>
        </div>
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
