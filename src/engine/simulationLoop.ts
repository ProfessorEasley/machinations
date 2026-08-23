export interface SimulationLoopOptions {
  intervalMs: number;
  onTick: () => void;
  shouldSkipTick?: () => boolean;
  onError?: (err: unknown) => void;
}

export interface SimulationLoopHandle {
  stop: () => void;
}

/**
 * Headless setInterval wrapper for the simulation tick loop.
 * Returns a handle with a `stop()` method to clear the interval.
 *
 * Canvas uses this instead of a raw setInterval so the loop logic
 * can also be reused in server / test contexts.
 */
export function startSimulationLoop(
  options: SimulationLoopOptions
): SimulationLoopHandle {
  const { intervalMs, onTick, shouldSkipTick, onError } = options;

  const id = setInterval(() => {
    if (shouldSkipTick?.()) return;
    try {
      onTick();
    } catch (err) {
      if (onError) {
        onError(err);
      } else {
        console.error('SimulationLoop error:', err);
      }
      clearInterval(id);
    }
  }, intervalMs);

  return {
    stop() {
      clearInterval(id);
    },
  };
}
