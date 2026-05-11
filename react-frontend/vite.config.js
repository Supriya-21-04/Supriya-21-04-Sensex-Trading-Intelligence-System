import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react-router-dom': path.resolve(__dirname, 'node_modules/react-router-dom'),
      papaparse: path.resolve(__dirname, 'node_modules/papaparse'),
      'react-chartjs-2': path.resolve(__dirname, 'node_modules/react-chartjs-2'),
      'chart.js': path.resolve(__dirname, 'node_modules/chart.js'),
      'simple-statistics': path.resolve(__dirname, 'node_modules/simple-statistics'),
      'tesseract.js': path.resolve(__dirname, 'node_modules/tesseract.js'),
      xlsx: path.resolve(__dirname, 'node_modules/xlsx'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
