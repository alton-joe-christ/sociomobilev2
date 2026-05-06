import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.socioapp.mobile',
  appName: 'SOCIO',
  webDir: 'out',
  server: {
    url: 'https://app.withsocio.com',
    androidScheme: 'https',
    allowNavigation: [
      'app.withsocio.com',
      'vkappuaapscvteexogtp.supabase.co',
      'socio2026v2server.vercel.app',
      'placehold.co',
      'lh3.googleusercontent.com',
      'christuniversity.in'
    ]
  },


  android: {
    allowMixedContent: true
  }
};

export default config;
