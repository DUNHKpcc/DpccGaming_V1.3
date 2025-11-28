<template>
  <div class="docs-page">
    <div class="content-wrapper">
      <div class="container mx-auto px-4 py-8">
        <h1 class="text-3xl font-bold text-white mb-4">文档（Docs）</h1>
        <p class="text-white/70">
          文档内容正在编写中，后续会在这里提供 DpccGaming 的平台说明和开发指南。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.docs-page {
  min-height: 100vh;
  background: radial-gradient(circle at top, rgba(255, 255, 255, 0.1), transparent 55%),
    radial-gradient(circle at bottom, rgba(0, 0, 0, 0.7), #050509);
}

.content-wrapper {
  padding-top: 5rem;
}

@media (min-width: 1024px) {
  .docs-page .content-wrapper {
    padding-left: 96px;
  }
}

@media (min-width: 1536px) {
  .docs-page .content-wrapper {
    padding-left: 120px;
  }
}
</style>

