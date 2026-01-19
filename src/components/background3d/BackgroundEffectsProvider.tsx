"use client";

import * as React from "react";

export type InferencePulseMode = "ai" | "neutral" | "system";

export type InferencePulseOptions = {
  intensity?: number;
  durationMs?: number;
  mode?: InferencePulseMode;
};

export type InferencePulseState = {
  startTime: number;
  durationMs: number;
  intensity: number;
  mode: InferencePulseMode;
};

type BackgroundEffectsContextValue = {
  pulse: InferencePulseState | null;
  idleEnabled: boolean;
  triggerInferencePulse: (options?: InferencePulseOptions) => void;
  setInferenceIdleEnabled: (enabled: boolean) => void;
};

const BackgroundEffectsContext =
  React.createContext<BackgroundEffectsContextValue | null>(null);

const DEFAULT_PULSE: Required<InferencePulseOptions> = {
  intensity: 0.85,
  durationMs: 900,
  mode: "ai",
};

export function BackgroundEffectsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pulse, setPulse] = React.useState<InferencePulseState | null>(null);
  const [idleEnabled, setIdleEnabled] = React.useState(
    process.env.NODE_ENV !== "production"
  );

  const triggerInferencePulse = React.useCallback(
    (options: InferencePulseOptions = {}) => {
      const { intensity, durationMs, mode } = {
        ...DEFAULT_PULSE,
        ...options,
      };
      setPulse({
        startTime: performance.now(),
        durationMs,
        intensity,
        mode,
      });
    },
    []
  );

  const value = React.useMemo(
    () => ({
      pulse,
      idleEnabled,
      triggerInferencePulse,
      setInferenceIdleEnabled: setIdleEnabled,
    }),
    [pulse, idleEnabled, triggerInferencePulse]
  );

  return (
    <BackgroundEffectsContext.Provider value={value}>
      {children}
    </BackgroundEffectsContext.Provider>
  );
}

export function useBackgroundEffects() {
  const context = React.useContext(BackgroundEffectsContext);
  if (!context) {
    throw new Error(
      "useBackgroundEffects must be used within a BackgroundEffectsProvider"
    );
  }
  return context;
}

// Usage example:
// const { triggerInferencePulse } = useBackgroundEffects();
// onMouseEnter={() => triggerInferencePulse({ intensity: 0.9 })}