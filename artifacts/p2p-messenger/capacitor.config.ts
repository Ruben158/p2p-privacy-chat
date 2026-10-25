import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.p2pmessenger.mobile',
  appName: 'P2P Messenger',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
