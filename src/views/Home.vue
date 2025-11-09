<template>
  <div class="home-page">
    <!-- 英雄区域 -->
    <HeroSection />
    
    <!-- 游戏展示区域 -->
    <GameShowcase />
    
    <!-- 页脚 -->
    <footer class="text-white py-8" style="background-color: rgb(29, 29, 31);">
      <div class="container mx-auto px-4 text-center">
        <div class="flex items-center justify-center mb-4">
          <img src="/logo.png" alt="DpccGaming Logo" class="w-8 h-8 mr-2">
          <span class="text-2xl font-bold">DpccGaming</span>
        </div>
        <p class="text-gray-400 mb-6">这是一个面向个人开发者的游戏收集平台</p>
        <div class="border-t border-gray-800 pt-6 text-center text-gray-500 text-sm">
          <p>&copy; 2025 SunJiaHao. All rights reserved.</p>
          <p class="mt-2">
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" 
               class="text-gray-400 hover:text-white transition-colors duration-300 underline">
              闽ICP备2025115401号
            </a>
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import HeroSection from '../components/HeroSection.vue'
import GameShowcase from '../components/GameShowcase.vue'
</script>

<style scoped>
.home-page {
  min-height: 100vh;
}

footer {
  margin-top: 0; /* 移除页脚顶部间距 */
}
</style>
