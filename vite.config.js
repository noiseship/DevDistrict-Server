export default {
  base: './',
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      output: {format: 'iife', inlineDynamicImports: true},
    },
  },
  server: {host: '127.0.0.1', port: 5173, strictPort: true, hmr: false},
  preview: {host: '127.0.0.1', port: 4173, strictPort: true},
};
