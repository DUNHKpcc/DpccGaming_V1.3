import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 8080,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'pinia'],
          gsap: ['gsap']
        }
      }
    }
  },
  base: './',  // 确保相对路径正确
  publicDir: 'public',  // 指定public目录
  assetsInclude: ['**/*.mp4', '**/*.webm', '**/*.jpg', '**/*.png', '**/*.jpeg']  // 包含视频和图片资源
})
