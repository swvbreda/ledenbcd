import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform()) return;

    let cleanup = false;

    const setup = async () => {
      // Dynamically import to avoid issues on web
      const { PushNotifications } = await import("@capacitor/push-notifications");

      // Request permission
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== "granted") {
        console.log("Push permission not granted");
        return;
      }

      // Register for push
      await PushNotifications.register();

      // Listen for registration success
      PushNotifications.addListener("registration", async (token) => {
        console.log("Push registration token:", token.value);

        // Upsert device token in database
        const { error } = await supabase.from("push_device_tokens").upsert(
          {
            user_id: user.id,
            device_token: token.value,
            platform: "ios",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,device_token" }
        );

        if (error) {
          console.error("Failed to save device token:", error);
        }
      });

      // Listen for registration errors
      PushNotifications.addListener("registrationError", (err) => {
        console.error("Push registration error:", err);
      });

      // Listen for incoming notifications while app is open
      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("Push received:", notification);
      });

      // Listen for notification taps
      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("Push action:", action);
      });
    };

    setup();

    return () => {
      cleanup = true;
    };
  }, [user]);
}
