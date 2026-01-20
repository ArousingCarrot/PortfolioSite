import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BackgroundCanvas } from "../components/background3d/BackgroundCanvas";
import { BackgroundEffectsProvider } from "../components/background3d/BackgroundEffectsProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BG = "#0a0a0d"; // dark grey
const DOT = "rgba(255,255,255,0.045)"; // subtle dots

export const metadata: Metadata = {
  title: "Samuel J. Baker IV",
  description: "Portfolio",
  themeColor: BG,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Inline background + dot-grid: prevents any white flash before CSS loads.
  const prepaintStyle: React.CSSProperties = {
    backgroundColor: BG,
    backgroundImage: `
      radial-gradient(${DOT} 1px, transparent 1px),
      radial-gradient(900px circle at 30% 25%, rgba(255,255,255,0.06), transparent 55%),
      radial-gradient(900px circle at 70% 65%, rgba(255,215,120,0.035), transparent 58%)
    `,
    backgroundSize: "28px 28px, auto, auto",
    backgroundPosition: "center, center, center",
  };

  return (
    <html lang="en" style={{ backgroundColor: BG, colorScheme: "dark" }}>
      <head>
        <style>{`html, body { background: ${BG}; }`}</style>
      </head>
      <body
        style={{ backgroundColor: BG }}
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-neutral-100`}
      >
        {/* Prepaint layer: always visible immediately */}
        <div
          aria-hidden="true"
          style={prepaintStyle}
          className="fixed inset-0 z-0 pointer-events-none"
        />

        <BackgroundEffectsProvider>
          {/* Canvas sits above the dot grid */}
          <BackgroundCanvas />
          {/* Foreground content */}
          <div className="relative z-20">{children}</div>
        </BackgroundEffectsProvider>
      </body>
    </html>
  );
}
