import type { CapacitorConfig } from '@capacitor/cli';

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
    allowMixedContent: true,
    captureInput: true,
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
