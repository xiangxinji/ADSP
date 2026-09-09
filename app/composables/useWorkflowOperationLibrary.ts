import { computed, ref } from 'vue'
import type { AssetType } from '#shared/types/asdp'
import { workflowOperationGroups } from '../utils/workflow-operation-library'

export const useWorkflowOperationLibrary = () => {
  const search = ref('')
  const category = ref<AssetType | 'all'>('all')
  const collapsed = ref<AssetType[]>([])
  const categories = workflowOperationGroups()
  const groups = computed(() => workflowOperationGroups(search.value, category.value))
  const operationCount = categories.reduce((count, group) => count + group.operations.length, 0)
  const resultCount = computed(() => groups.value.reduce((count, group) => count + group.operations.length, 0))
  const isExpanded = (assetType: AssetType) => Boolean(search.value.trim()) || !collapsed.value.includes(assetType)
  const toggleGroup = (assetType: AssetType) => {
    collapsed.value = collapsed.value.includes(assetType)
      ? collapsed.value.filter(value => value !== assetType)
      : [...collapsed.value, assetType]
  }
  const resetFilters = () => {
    search.value = ''
    category.value = 'all'
  }
  return { search, category, categories, groups, operationCount, resultCount, isExpanded, toggleGroup, resetFilters }
}
