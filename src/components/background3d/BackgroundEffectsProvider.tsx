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
  intensity: 0.75,
  durationMs: 850,
  mode: "ai",
};

export function BackgroundEffectsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pulse, setPulse] = React.useState<InferencePulseState | null>(null);
  const [idleEnabled, setIdleEnabled] = React.useState(false);

  const clearTimerRef = React.useRef<number | null>(null);

  const triggerInferencePulse = React.useCallback(
    (options: InferencePulseOptions = {}) => {
      const { intensity, durationMs, mode } = {
        ...DEFAULT_PULSE,
        ...options,
      };

      // Clear any scheduled reset so rapid triggers still feel responsive.
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      setPulse({
        startTime: performance.now(),
        durationMs,
        intensity,
        mode,
      });

      // Always clear pulse state after it ends.
      clearTimerRef.current = window.setTimeout(() => {
        setPulse(null);
        clearTimerRef.current = null;
      }, durationMs + 34);
    },
    []
  );

  React.useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

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
