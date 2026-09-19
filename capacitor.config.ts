import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'uz.mydash.app',
  appName: 'Мой дашборд',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
}

export default config
