/**
 * Edge-scroll detector for paginated viewers.
 *
 * Tracks how much the user has scrolled past the top/bottom edge of a
 * scrollable area. Only fires `next` / `prev` once the user accumulates
 * `threshold` pixels of intent in the same direction *while staying at
 * the edge*. After firing, a `cooldown` window suppresses further events
 * (and resets the accumulators) so momentum scrolling doesn't flip
 * multiple pages.
 */
export interface EdgeScrollOptions {
  /** Pixels of overscroll required before triggering. Default 80. */
  threshold?: number;
  /** Time in ms after a trigger during which all input is ignored. Default 600. */
  cooldown?: number;
  /** Injectable clock for tests. Default Date.now. */
  now?: () => number;
}

export type EdgeScrollResult = "next" | "prev" | null;

export interface EdgeScrollDetector {
  /**
   * Feed a wheel/touch delta. Positive deltaY = scroll down, negative = up.
   * `atTop` / `atBottom` describe the *current* scroll position.
   */
  feed(deltaY: number, atTop: boolean, atBottom: boolean): EdgeScrollResult;
  reset(): void;
}

export function createEdgeScrollDetector(
  opts: EdgeScrollOptions = {},
): EdgeScrollDetector {
  const threshold = opts.threshold ?? 80;
  const cooldown = opts.cooldown ?? 600;
  const now = opts.now ?? (() => Date.now());

  let accDown = 0;
  let accUp = 0;
  let lastTrigger = -Infinity;

  return {
    feed(deltaY, atTop, atBottom) {
      const t = now();
      if (t - lastTrigger < cooldown) {
        // Still in cooldown (e.g. momentum from the trigger itself).
        // Eat the event and keep accumulators at zero.
        accDown = 0;
        accUp = 0;
        return null;
      }
      if (deltaY > 0 && atBottom) {
        accDown += deltaY;
        accUp = 0;
        if (accDown >= threshold) {
          accDown = 0;
          lastTrigger = t;
          return "next";
        }
      } else if (deltaY < 0 && atTop) {
        accUp += -deltaY;
        accDown = 0;
        if (accUp >= threshold) {
          accUp = 0;
          lastTrigger = t;
          return "prev";
        }
      } else {
        // Not at the edge in the relevant direction — discard intent.
        accDown = 0;
        accUp = 0;
      }
      return null;
    },
    reset() {
      accDown = 0;
      accUp = 0;
    },
  };
}