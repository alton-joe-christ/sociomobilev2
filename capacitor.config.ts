import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.socioapp.mobile',
  appName: 'SOCIO',
  webDir: 'out',
  android: {
    allowMixedContent: false
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;

