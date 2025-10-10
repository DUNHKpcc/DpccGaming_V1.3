<template>
  <footer class="bg-dark text-white py-8">
    <div class="container mx-auto px-4">
      <!-- 主要内容区域 -->
      <div class="text-center mb-8">
        <div class="flex items-center justify-center mb-4">
          <img src="/logo.png" alt="DpccGaming Logo" class="w-8 h-8 mr-2">
          <span class="text-2xl font-bold">DpccGaming</span>
        </div>
        <p class="text-gray-400 mb-6">这是一个面向个人开发者的游戏收集平台</p>
      </div>

      <!-- 赞助商区域 -->
      <div class="border-t border-gray-800 pt-6 mb-6">
        <div class="text-center mb-4">
          <h3 class="text-lg font-semibold text-gray-300 mb-2">特别感谢</h3>
          <p class="text-sm text-gray-500">感谢以下合作伙伴的支持</p>
        </div>
        
        <div class="flex items-center justify-center">
          <div class="sponsor-logo-container bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all duration-300">
            <img 
              src="/logo.png" 
              alt="DpccGaming Logo" 
              class="sponsor-logo h-12 w-auto mx-auto opacity-80 hover:opacity-100 transition-opacity duration-300"
              loading="lazy">
          </div>
        </div>
      </div>

      <!-- 版权信息 -->
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
</template>

<script setup>
// 页脚组件不需要额外的逻辑
</script>

<style scoped>
/* 赞助商logo样式 */
.sponsor-logo-container {
  transition: all 0.3s ease;
  cursor: pointer;
}

.sponsor-logo-container:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.sponsor-logo {
  filter: grayscale(20%);
  transition: all 0.3s ease;
}

.sponsor-logo-container:hover .sponsor-logo {
  filter: grayscale(0%);
  transform: scale(1.05);
}

/* 响应式设计 */
@media (max-width: 640px) {
  .sponsor-logo-container {
    padding: 0.75rem;
  }
  
  .sponsor-logo {
    height: 2.5rem;
  }
}
</style>
