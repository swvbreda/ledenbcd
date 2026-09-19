import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform()) return;

    let cancelled = false;
    const listenerHandles: Array<{ remove: () => Promise<void> }> = [];

    const rememberListener = (handle: { remove: () => Promise<void> }) => {
      if (cancelled) void handle.remove();
      else listenerHandles.push(handle);
    };

    const setup = async () => {
      // Dynamically import to avoid issues on web
      const { PushNotifications } =
        await import("@capacitor/push-notifications");

      // Register listeners before register(); iOS can return the APNs token immediately.
      rememberListener(
        await PushNotifications.addListener("registration", async (token) => {
          const { error } = await supabase.from("push_device_tokens").upsert(
            {
              user_id: user.id,
              device_token: token.value,
              platform: "ios",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,device_token" },
          );

          if (error) console.error("Failed to save device token:", error);
        }),
      );

      rememberListener(
        await PushNotifications.addListener("registrationError", (err) => {
          console.error("Push registration error:", err);
        }),
      );

      rememberListener(
        await PushNotifications.addListener(
          "pushNotificationReceived",
          (notification) => {
            console.log("Push received:", notification);
          },
        ),
      );

      rememberListener(
        await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            const route = action.notification.data?.route;
            if (
              typeof route === "string" &&
              route.startsWith("/") &&
              !route.startsWith("//")
            ) {
              window.location.assign(route);
            }
          },
        ),
      );

      // Respect the user's explicit choice in Mijn account.
      if (localStorage.getItem("bcd-push-disabled") === "true") return;

      // Request permission
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== "granted") {
        console.log("Push permission not granted");
        return;
      }

      // Register for push
      await PushNotifications.register();
    };

    void setup();

    return () => {
      cancelled = true;
      listenerHandles.forEach((handle) => void handle.remove());
    };
  }, [user]);
}
