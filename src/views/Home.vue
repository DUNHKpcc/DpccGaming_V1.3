<template>
  <div class="home-page">

    <HeroSection />

    <GameShowcase />

    <Footer />
  </div>
</template>

<script setup>
import HeroSection from '../components/HeroSection.vue'
import GameShowcase from '../components/GameShowcase.vue'
import Footer from '../components/Footer.vue'
</script>

<style scoped>
.home-page {
  min-height: 100vh;
}
</style>
