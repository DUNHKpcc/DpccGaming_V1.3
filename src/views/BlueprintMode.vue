<script setup>
import { computed, onMounted, ref } from 'vue'
import { useGameStore } from '../stores/game'
import BlueprintSidebar from '../components/blueprint/BlueprintSidebar.vue'
import BlueprintToolbar from '../components/blueprint/BlueprintToolbar.vue'
import BlueprintCanvasStage from '../components/blueprint/BlueprintCanvasStage.vue'

const gameStore = useGameStore()

const modelOptions = [
  { name: 'ClaudeOpus4.6' },
  { name: 'DouBaoSeed1.6' },
  { name: 'ChatGPT5.4' },
  { name: 'Qwen3-code' }
]

const seed = ref('ABHYUIJHJKK67890900')
const logs = ref([])

const libraryGames = computed(() => gameStore.games || [])

onMounted(async () => {
  if (!gameStore.gamesLoaded) {
    await gameStore.loadGames()
  }
})
</script>

<template>
  <div class="bp-page">
    <BlueprintSidebar
      :games="libraryGames"
      :seed="seed"
      :logs="logs"
      :model-options="modelOptions"
    />

    <main class="bp-main">
      <BlueprintToolbar />
      <BlueprintCanvasStage />
    </main>
  </div>
</template>

<style src="../styles/blueprint-mode.css"></style>
