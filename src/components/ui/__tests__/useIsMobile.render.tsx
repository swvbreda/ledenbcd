import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";

let matches = false;
beforeEach(() => {
  matches = false;
  window.matchMedia = ((q: string) => ({
    get matches() { return matches; },
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

describe("useIsMobile", () => {
  it("reads the media query on first render, not a desktop default", () => {
    matches = true;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("updates when the app resumes with a different viewport", () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    matches = true;
    act(() => { window.dispatchEvent(new Event("pageshow")); });
    expect(result.current).toBe(true);
  });
});
