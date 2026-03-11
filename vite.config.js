import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => ['a-waves'].includes(tag)
        }
      }
    })
  ],
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
  base: '/',  // 避免深层路由刷新时资源路径错误（如 /coding/:id）
  publicDir: 'public',  // 指定public目录
  assetsInclude: ['**/*.mp4', '**/*.webm', '**/*.jpg', '**/*.png', '**/*.jpeg']  // 包含视频和图片资源
})
