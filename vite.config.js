import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' — сайт работает в любой подпапке GitHub Pages
export default defineConfig({
  base: './',
  plugins: [react()],
});
