<template>
  <div class="home-page">

    <HeroSection />

    <GameShowcase />

    <Footer />

    <BrandRevealSection />
  </div>
</template>

<script setup>
import HeroSection from '../components/HeroSection.vue'
import GameShowcase from '../components/GameShowcase.vue'
import Footer from '../components/Footer.vue'
import BrandRevealSection from '../components/BrandRevealSection.vue'
</script>

<style scoped>
.home-page {
  min-height: 100vh;
}
</style>
