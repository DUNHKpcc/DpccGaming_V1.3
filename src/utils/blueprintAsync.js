import { defineAsyncComponent } from 'vue'
import BlueprintRouteLoading from '../components/blueprint/BlueprintRouteLoading.vue'

let blueprintModulePromise = null

const loadBlueprintMode = () => import('../views/BlueprintMode.vue')

export const prefetchBlueprintMode = () => {
  if (!blueprintModulePromise) {
    blueprintModulePromise = loadBlueprintMode().catch((error) => {
      blueprintModulePromise = null
      throw error
    })
  }

  return blueprintModulePromise
}

export const BlueprintModeAsync = defineAsyncComponent({
  loader: prefetchBlueprintMode,
  delay: 120,
  loadingComponent: BlueprintRouteLoading
})
