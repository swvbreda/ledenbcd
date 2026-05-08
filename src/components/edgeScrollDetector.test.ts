import { describe, it, expect } from "vitest";
import { createEdgeScrollDetector } from "./edgeScrollDetector";

describe("createEdgeScrollDetector", () => {
  it("does not trigger on small overscroll below the threshold", () => {
    const d = createEdgeScrollDetector({ threshold: 80, cooldown: 600 });
    expect(d.feed(20, false, true)).toBeNull();
    expect(d.feed(20, false, true)).toBeNull();
    expect(d.feed(30, false, true)).toBeNull(); // total 70 < 80
  });

  it("triggers next once accumulated overscroll passes the threshold at bottom", () => {
    const d = createEdgeScrollDetector({ threshold: 80, cooldown: 600 });
    expect(d.feed(40, false, true)).toBeNull();
    expect(d.feed(50, false, true)).toBe("next"); // 90 >= 80
  });

  it("triggers prev once accumulated overscroll passes the threshold at top", () => {
    const d = createEdgeScrollDetector({ threshold: 80, cooldown: 600 });
    expect(d.feed(-30, true, false)).toBeNull();
    expect(d.feed(-60, true, false)).toBe("prev");
  });

  it("does not trigger when scrolling within the page (not at edge)", () => {
    const d = createEdgeScrollDetector({ threshold: 50 });
    expect(d.feed(100, false, false)).toBeNull();
    expect(d.feed(100, false, false)).toBeNull();
  });

  it("ignores wrong-direction wheel even at an edge", () => {
    const d = createEdgeScrollDetector({ threshold: 50 });
    // At top, scrolling down should not trigger prev/next
    expect(d.feed(100, true, false)).toBeNull();
    // At bottom, scrolling up should not trigger
    expect(d.feed(-100, false, true)).toBeNull();
  });

  it("resets accumulator when the user scrolls back into the page", () => {
    const d = createEdgeScrollDetector({ threshold: 80 });
    d.feed(40, false, true); // partial intent
    // user scrolls up inside the page → no longer at bottom edge
    expect(d.feed(-10, false, false)).toBeNull();
    // back at bottom: needs full threshold again
    expect(d.feed(50, false, true)).toBeNull();
    expect(d.feed(40, false, true)).toBe("next");
  });

  it("suppresses further triggers during the cooldown window (momentum)", () => {
    let t = 1000;
    const d = createEdgeScrollDetector({ threshold: 50, cooldown: 600, now: () => t });
    expect(d.feed(60, false, true)).toBe("next");
    // Momentum events arriving shortly after — should all be ignored
    t = 1100;
    expect(d.feed(80, false, true)).toBeNull();
    t = 1300;
    expect(d.feed(120, false, true)).toBeNull();
    t = 1500;
    expect(d.feed(40, false, true)).toBeNull();
  });

  it("allows a new trigger after the cooldown elapses", () => {
    let t = 1000;
    const d = createEdgeScrollDetector({ threshold: 50, cooldown: 600, now: () => t });
    expect(d.feed(60, false, true)).toBe("next");
    t = 2000; // well past cooldown
    expect(d.feed(30, false, true)).toBeNull();
    expect(d.feed(30, false, true)).toBe("next");
  });

  it("does not flip pages from a single large momentum delta after a trigger", () => {
    let t = 0;
    const d = createEdgeScrollDetector({ threshold: 80, cooldown: 600, now: () => t });
    // Initial intentful scroll
    expect(d.feed(90, false, true)).toBe("next");
    // One huge momentum delta during cooldown
    t = 200;
    expect(d.feed(500, false, true)).toBeNull();
  });
});