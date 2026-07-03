import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Mobile-optimized vendor chunk strategy
const vendorChunks: Record<string, string[]> = {
  'vendor-react': ['react', 'react-dom', 'react-is', 'react-router-dom', 'scheduler'],
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-query': ['@tanstack/react-query'],
  'vendor-charts': ['recharts', 'd3-shape', 'd3-scale', 'd3-interpolate', 'd3-color', 'd3-path', 'd3-format', 'd3-time', 'd3-time-format', 'd3-array'],
  'vendor-motion': ['framer-motion'],
  'vendor-icons': ['lucide-react'],
  'vendor-misc': ['date-fns', 'qrcode.react', 'jsqr'],
};

export default defineConfig(() => {
  return {
    server: {
      port: 5173,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['baro-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        workbox: {
          // The customer chat bundle can exceed the default 2 MiB precache cap after production minification.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        manifest: {
          name: 'Baro OS - Restaurant System',
          short_name: 'Baro OS',
          description: 'Sleek and powerful restaurant management system',
          theme_color: '#0d1117',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    define: {},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    },
    build: {
      // Target modern browsers for smaller output (no legacy polyfills)
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // Vendor splitting: each library gets its own cacheable chunk
            for (const [chunkName, packages] of Object.entries(vendorChunks)) {
              if (packages.some(pkg => id.includes(`node_modules/${pkg}/`) || id.includes(`node_modules\\${pkg}\\`))) {
                return chunkName;
              }
            }
          },
        },
      },
    }
  };
});
