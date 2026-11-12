import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const here = (f) => path.resolve(import.meta.dirname, f);

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    'process.env.EXPO_PUBLIC_API_URL': JSON.stringify(process.env.EXPO_PUBLIC_API_URL ?? ''),
    global: 'globalThis',
  },
  server: { port: 5173, fs: { allow: [path.resolve(import.meta.dirname, '..')] } },
  resolve: {
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.js', '.json'],
    alias: {
      'react-native': 'react-native-web',
      'react-native-google-mobile-ads': here('stubs.ts'),
      'react-native-iap': here('stubs.ts'),
      'react-native-safe-area-context': here('safeArea.tsx'),
      'react-native-url-polyfill/auto': here('empty.ts'),
      '@react-native-async-storage/async-storage': here('storageStub.ts'),
    },
  },
});
