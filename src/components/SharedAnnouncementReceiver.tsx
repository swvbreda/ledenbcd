import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/hooks/useAuth";

function receiveShare(urlValue: string, canManage: boolean) {
  if (!canManage) return;
  try {
    const url = new URL(urlValue);
    if (url.protocol !== "bcdleden:" || url.hostname !== "share") return;
    const text = url.searchParams.get("text")?.trim();
    if (!text) return;
    window.location.assign(`/aankondigingen?share=${encodeURIComponent(text)}`);
  } catch {
    // Ignore malformed external URLs.
  }
}

export default function SharedAnnouncementReceiver() {
  const { isAdmin, isBoard } = useAuth();
  const canManage = isAdmin || isBoard;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let removeListener: (() => Promise<void>) | undefined;

    void App.getLaunchUrl().then((result) => {
      if (!disposed && result?.url) receiveShare(result.url, canManage);
    });

    void App.addListener("appUrlOpen", ({ url }) =>
      receiveShare(url, canManage),
    ).then((handle) => {
      if (disposed) void handle.remove();
      else removeListener = () => handle.remove();
    });

    return () => {
      disposed = true;
      if (removeListener) void removeListener();
    };
  }, [canManage]);

  return null;
}
