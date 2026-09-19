import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'nl.coffeeshopbond.leden',
  appName: 'BCD leden',
  webDir: 'capacitor-web',
  server: {
    // Use the canonical production host directly. The old Lovable URL now
    // redirects to this host, which can leave Capacitor's WKWebView blank.
    url: 'https://leden.coffeeshopbond.nl',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    }
  }
};

export default config;
