import * as React from "react";

export const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/**
 * Reads the media query itself (not window.innerWidth, which WKWebView can
 * report before its first real layout) and re-reads on every event that can
 * change the viewport in a native shell: media change, resize, orientation,
 * bfcache restore (pageshow) and app resume (visibilitychange).
 */
function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  const vv = window.visualViewport;
  const onVisible = () => {
    if (document.visibilityState === "visible") onChange();
  };
  mql.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  window.addEventListener("pageshow", onChange);
  document.addEventListener("visibilitychange", onVisible);
  vv?.addEventListener("resize", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
    window.removeEventListener("pageshow", onChange);
    document.removeEventListener("visibilitychange", onVisible);
    vv?.removeEventListener("resize", onChange);
  };
}

function getSnapshot() {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(QUERY).matches;
}

const getServerSnapshot = () => false;

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
