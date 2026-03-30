<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import BlueprintRouteLoading from '../components/blueprint/BlueprintRouteLoading.vue'
import { BlueprintModeAsync, prefetchBlueprintMode } from '../utils/blueprintAsync'

const BLUEPRINT_ROUTE_LOADING_MS = 720

const showLoading = ref(true)

let loadingTimer = null

onMounted(() => {
  prefetchBlueprintMode().catch((error) => {
    console.error('BluePrint 路由预加载失败:', error)
  })

  loadingTimer = window.setTimeout(() => {
    showLoading.value = false
    loadingTimer = null
  }, BLUEPRINT_ROUTE_LOADING_MS)
})

onBeforeUnmount(() => {
  if (!loadingTimer) return

  window.clearTimeout(loadingTimer)
  loadingTimer = null
})
</script>

<template>
  <BlueprintRouteLoading v-if="showLoading" />
  <BlueprintModeAsync v-else />
</template>
