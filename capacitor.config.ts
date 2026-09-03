import type { CapacitorConfig } from '@capacitor/cli';

/**
 * CRIM-SYS 2026 — Capacitor Configuration
 *
 * NOTE for production builds:
 * - Remove `android.allowMixedContent: true` before publishing to Play Store.
 * - `android:usesCleartextTraffic="true"` in AndroidManifest.xml is for
 *   development only; remove it for production signing.
 */
const config: CapacitorConfig = {
  appId: 'net.crimsys.app',
  appName: 'CRIM-SYS 2026',
  webDir: 'dist',
  bundledWebRuntime: false,

  // Android-specific configuration
  android: {
    buildOptions: {
      keystorePath: undefined, // Set via environment or CI
      keystoreAlias: undefined,
      releaseType: 'APK',
    },
    // Allow mixed HTTP/HTTPS content during development.
    // IMPORTANT: Set to false before production release.
    allowMixedContent: true,
    captureInput: true,
  },

  // Server configuration
  server: {
    androidScheme: 'https',
    // For development, point to your dev server:
    // url: 'http://10.0.2.2:5173',
    // cleartext: true,
  },

  // Plugin configuration
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Filesystem: {
      // Default to Documents directory for backups
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1625',
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
    },
  },

  // iOS-specific (for future use)
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#1a1625',
  },
};

export default config;
