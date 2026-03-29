<template>
  <section class="bp-route-loading">
    <div class="bp-route-loading-card">
      <div class="bp-route-loading-brand">
        <img src="/logo_light.png" alt="BluePrint" />
        <div>
          <strong>BluePrint</strong>
          <span>蓝图模式加载中....</span>
        </div>
      </div>

      <div class="bp-route-loading-bar">
        <span></span>
      </div>

      <div class="bp-route-loading-grid" aria-hidden="true">
        <span v-for="index in 6" :key="index"></span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bp-route-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 32px;
  background: #ffffff;
}

.bp-route-loading-card {
  width: min(520px, 100%);
  padding: 28px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 24px;
  background: #ffffff;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.08);
}

.bp-route-loading-brand {
  display: flex;
  align-items: center;
  gap: 16px;
}

.bp-route-loading-brand img {
  width: 38px;
  height: 38px;
  object-fit: contain;
  display: block;
}

.bp-route-loading-brand strong,
.bp-route-loading-brand span {
  display: block;
}

.bp-route-loading-brand strong {
  color: #111111;
  font-size: 1.1rem;
  font-weight: 700;
}

.bp-route-loading-brand span {
  margin-top: 4px;
  color: #7a7a7a;
  font-size: 0.85rem;
}

.bp-route-loading-bar {
  height: 8px;
  margin-top: 22px;
  overflow: hidden;
  border-radius: 999px;
  background: #e9e9e9;
}

.bp-route-loading-bar span {
  display: block;
  width: 34%;
  height: 100%;
  border-radius: inherit;
  background: #111111;
  animation: bp-route-loading-bar 1.2s ease-in-out infinite;
}

.bp-route-loading-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 24px;
}

.bp-route-loading-grid span {
  display: block;
  height: 96px;
  border-radius: 16px;
  background: linear-gradient(90deg, #efefef, #fafafa, #efefef);
  background-size: 200% 100%;
  animation: bp-route-loading-sheen 1.6s linear infinite;
}

@keyframes bp-route-loading-bar {
  0% {
    transform: translateX(-28%);
  }

  50% {
    transform: translateX(122%);
  }

  100% {
    transform: translateX(-28%);
  }
}

@keyframes bp-route-loading-sheen {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
</style>
