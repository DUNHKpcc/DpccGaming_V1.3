<template>
  <div class="cookie-policy-page text-white">
    <section class="policy-hero">
      <div class="container mx-auto px-4 py-16 text-center space-y-4">
        <p class="text-sm uppercase tracking-[0.3em] text-white/70">COOKIE POLICY</p>
        <h1 class="text-4xl md:text-5xl font-semibold">Cookie 使用与管理</h1>
        <p class="text-lg text-white/70 max-w-3xl mx-auto">
          为了保障 DpccGaming 的安全与个性化体验，我们会在获得允许后设置不同类型的 Cookie，并把您的授权状态安全地保存在内部数据库。
        </p>
        <button
          type="button"
          class="px-6 py-3 rounded-xl bg-white text-[#1d1d1f] font-semibold hover:bg-white/90 transition"
          @click="openPreferences"
        >
          重新打开 Cookie 设置
        </button>
      </div>
    </section>

    <section class="policy-content container mx-auto px-4 py-12 space-y-10">
      <article class="glass-card">
        <h2>1. 我们使用 Cookie 的原因</h2>
        <p>
          Cookie 让我们能够保障登录安全、记住您在游戏库、蓝图模式和 Coding 模式中的选择，并通过聚合的分析数据持续优化性能。
          没有这些信息，很多上传、付费或评论相关的操作将无法顺畅完成。
        </p>
      </article>

      <article class="glass-card">
        <h2>2. Cookie 类型与数据保留</h2>
        <ul class="list-disc list-inside text-white/80 space-y-2">
          <li>必要：认证、上传、支付安全所必须，始终开启且不含任何营销信息。</li>
          <li>功能：用于记住您的主题、语言及偏好导航设置。</li>
          <li>分析：帮助我们了解页面访问量和错误趋势，仅以聚合方式使用。</li>
          <li>营销：在获得许可后展示更匹配的推荐或合作内容。</li>
        </ul>
        <p class="mt-4">
          每一次授权都会生成唯一的 <code class="code-chip">cookie ID</code>，并存放在 DpccGaming 的内部数据库，
          记录您的同意状态、偏好开关、操作 IP 及时间戳，以便审计与用户支持。
        </p>
      </article>

      <article class="glass-card">
        <h2>3. 如何管理偏好</h2>
        <p>
          您可以随时通过页面底部「Cookie 设置」按钮或上方的“重新打开 Cookie 设置”按钮唤起同意弹窗，
          更新或撤回授权。我们会立即同步最新的偏好到数据库，并在本地替换旧记录。
        </p>
        <p class="mt-2">
          此外，您也可以在浏览器设置中清除 Cookie，但为了保证登录和作品上传不受影响，建议保留必要 Cookie。
        </p>
      </article>

      <article class="glass-card">
        <h2>4. 联系方式</h2>
        <p>
          如果您对 Cookie 或数据存储方式有任何疑问，可以通过页脚的联系方式与我们联络，或发送邮件至
          <a class="underline decoration-dotted" href="sjh2329952249@163.com">sjh2329952249@163.com</a>。
        </p>
      </article>
    </section>

    <Footer />
  </div>
</template>

<script setup>
import Footer from '../components/Footer.vue';
import { useCookieStore } from '../stores/cookie';

const cookieStore = useCookieStore();
const openPreferences = () => {
  cookieStore.init();
  cookieStore.openPreferences();
};
</script>

<style scoped>
.cookie-policy-page {
  min-height: 100vh;
  background: radial-gradient(circle at top, rgba(255, 255, 255, 0.05), transparent 50%), #000;
}

.policy-hero {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(29, 29, 31, 0.8));
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.policy-content {
  max-width: 960px;
}

.glass-card {
  padding: 2rem;
  border-radius: 0.2rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
}

.glass-card h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.glass-card p {
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.8;
}

.code-chip {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  padding: 0.15rem 0.4rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.12);
}
</style>
