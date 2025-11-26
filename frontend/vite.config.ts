import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';

// Plugin to copy staticwebapp.config.json to dist
const copyStaticWebAppConfig = () => ({
  name: 'copy-staticwebapp-config',
  closeBundle() {
    copyFileSync(
      path.resolve(__dirname, 'staticwebapp.config.json'),
      path.resolve(__dirname, 'dist/staticwebapp.config.json')
    );
    console.log('✓ Copied staticwebapp.config.json to dist/');
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    copyStaticWebAppConfig(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
