import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Garante que process.env.API_KEY funcione no código existente
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
    ,
    server: {
      // Add a couple of safe dev headers to reduce some auditor noise in local testing
      headers: {
        'X-Content-Type-Options': 'nosniff'
      }
    }
  };
});