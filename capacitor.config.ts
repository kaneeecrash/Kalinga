import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Kalinga',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Geolocation: {
      Permissions: [ 'locations']
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
   }
 }
};

export default config;
