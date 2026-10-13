import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { longestWordLength } from "@/components/BcdHeroBanner";

let matches = false;
const mqlAdd = vi.fn(); const mqlRemove = vi.fn();
beforeEach(() => {
  matches = false; mqlAdd.mockClear(); mqlRemove.mockClear();
  window.matchMedia = ((q: string) => ({ get matches() { return matches; }, media: q,
    addEventListener: mqlAdd, removeEventListener: mqlRemove })) as unknown as typeof window.matchMedia;
});

describe("useIsMobile", () => {
  it("reads the media query on first render, not a desktop default", () => {
    matches = true;
    expect(renderHook(() => useIsMobile()).result.current).toBe(true);
  });

  it("server render uses the stable desktop snapshot", () => {
    const Probe = () => createElement("i", null, String(useIsMobile()));
    expect(renderToString(createElement(Probe))).toContain("false");
  });

  it.each(["pageshow", "orientationchange", "resize"])("re-reads after %s", (ev) => {
    const { result } = renderHook(() => useIsMobile());
    matches = true;
    act(() => { window.dispatchEvent(new Event(ev)); });
    expect(result.current).toBe(true);
  });

  it("re-reads when the app becomes visible again (resume)", () => {
    const { result } = renderHook(() => useIsMobile());
    matches = true;
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(result.current).toBe(true);
  });

  it("removes every listener on unmount", () => {
    const add = vi.spyOn(window, "addEventListener"); const rem = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useIsMobile());
    const added = add.mock.calls.map((c) => c[0]);
    unmount();
    expect(rem.mock.calls.map((c) => c[0]).sort()).toEqual(expect.arrayContaining(added));
    expect(mqlRemove).toHaveBeenCalledTimes(mqlAdd.mock.calls.length);
    add.mockRestore(); rem.mockRestore();
  });
});

describe("hero title fit", () => {
  it("measures the longest whole word, splitting only at spaces and hyphens", () => {
    expect(longestWordLength("Projecten & taken")).toBe(9);
    expect(longestWordLength("Contributie-administratie")).toBe(13);
    expect(longestWordLength("voor coffeeshopondernemers")).toBe(21);
  });
});
