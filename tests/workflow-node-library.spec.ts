import { ref } from 'vue'
import { describe, expect, test, vi } from 'vitest'
import { useWorkflowLibraryDrag } from '../app/composables/useWorkflowLibraryDrag'
import { useWorkflowOperationLibrary } from '../app/composables/useWorkflowOperationLibrary'
import { workflowOperationGroups } from '../app/utils/workflow-operation-library'
import { parseWorkflowNodeDragData, workflowNodeDragMime, type WorkflowNodeDragData } from '../app/utils/workflow-node-drag'
import { assetOperationConfig } from '../shared/config/asset-operations'

describe('workflow node library catalog', () => {
  test('lists every workflow-ready operation once and excludes client-only actions', () => {
    const expected = assetOperationConfig.modules.flatMap(module => module.operations
      .filter(operation => operation.workflow.enabled).map(operation => operation.id))
    const actual = workflowOperationGroups().flatMap(group => group.operations.map(operation => operation.id))
    expect(actual).toEqual(expected)
    expect(new Set(actual).size).toBe(actual.length)
    expect(workflowOperationGroups('repository.edit')).toEqual([])
  })

  test('retains full accessible labels and original compact labels from the contract', () => {
    const operation = workflowOperationGroups('repository.clone')[0]!.operations[0]!
    expect(operation).toMatchObject({ label: '仓库克隆', displayLabel: '克隆', assetType: 'repository', id: 'repository.clone' })
    expect(workflowOperationGroups('repository.list')[0]!.operations[0]!.displayLabel).toBe('获取所有仓库')
  })

  test.each(['  REPOSITORY.CLONE  ', '仓库 克隆', '克隆  仓库'])('matches names, IDs and multiple keywords: %s', query => {
    expect(workflowOperationGroups(query).flatMap(group => group.operations.map(operation => operation.id))).toContain('repository.clone')
  })

  test('combines search and asset filtering without empty groups', () => {
    expect(workflowOperationGroups('克隆', 'environment')).toEqual([])
    expect(workflowOperationGroups('', 'knowledge').map(group => group.assetType)).toEqual(['knowledge'])
    expect(workflowOperationGroups('impossible-node')).toEqual([])
    expect(workflowOperationGroups(' \t ')).toEqual(workflowOperationGroups())
  })
})

describe('workflow node library filters', () => {
  test('updates result counts while keeping the full category list and catalog count', () => {
    const library = useWorkflowOperationLibrary()
    const total = library.operationCount
    const categoryCount = library.categories.length
    expect(library.resultCount.value).toBe(total)
    library.category.value = 'environment'
    expect(library.groups.value.map(group => group.assetType)).toEqual(['environment'])
    expect(library.resultCount.value).toBe(1)
    library.search.value = 'repository.clone'
    expect(library.resultCount.value).toBe(0)
    expect(library.operationCount).toBe(total)
    expect(library.categories).toHaveLength(categoryCount)
    library.resetFilters()
    expect(library.search.value).toBe('')
    expect(library.category.value).toBe('all')
    expect(library.resultCount.value).toBe(total)
  })

  test('search temporarily reveals collapsed groups without losing the browsing state', () => {
    const library = useWorkflowOperationLibrary()
    expect(library.isExpanded('repository')).toBe(true)
    library.toggleGroup('repository')
    expect(library.isExpanded('repository')).toBe(false)
    library.search.value = 'repository.clone'
    expect(library.isExpanded('repository')).toBe(true)
    expect(library.resultCount.value).toBe(1)
    library.search.value = ' '
    expect(library.isExpanded('repository')).toBe(false)
    library.category.value = 'knowledge'
    library.category.value = 'all'
    expect(library.isExpanded('repository')).toBe(false)
    library.toggleGroup('repository')
    expect(library.isExpanded('repository')).toBe(true)
  })
})

describe('workflow node library drag interactions', () => {
  const createEvent = () => ({ preventDefault: vi.fn(), dataTransfer: { effectAllowed: '', setData: vi.fn() } })

  test.each<WorkflowNodeDragData>([
    { type: 'workflow' },
    { type: 'control', kind: 'sync' },
    { type: 'control', kind: 'async' },
    { type: 'operation', selection: { assetType: 'repository', operationId: 'repository.clone' } },
  ])('preserves the canvas drag contract: $type', data => {
    const library = useWorkflowLibraryDrag(true)
    const event = createEvent()
    library.startDrag(event as unknown as DragEvent, data, 'node')
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(event.dataTransfer.effectAllowed).toBe('copy')
    expect(event.dataTransfer.setData).toHaveBeenCalledOnce()
    const [mime, serialized] = event.dataTransfer.setData.mock.calls[0]!
    expect(mime).toBe(workflowNodeDragMime)
    expect(parseWorkflowNodeDragData(serialized)).toEqual(data)
    expect(library.draggingId.value).toBe('node')
    library.finishDrag()
    expect(library.draggingId.value).toBe('')
  })

  test('blocks dragging until a trigger is selected and tracks reactive availability', () => {
    const enabled = ref(false)
    const library = useWorkflowLibraryDrag(() => enabled.value)
    const blockedEvent = createEvent()
    library.startDrag(blockedEvent as unknown as DragEvent, { type: 'workflow' }, 'workflow')
    expect(blockedEvent.preventDefault).toHaveBeenCalledOnce()
    expect(blockedEvent.dataTransfer.setData).not.toHaveBeenCalled()
    expect(library.draggingId.value).toBe('')
    enabled.value = true
    const allowedEvent = createEvent()
    library.startDrag(allowedEvent as unknown as DragEvent, { type: 'workflow' }, 'workflow')
    expect(allowedEvent.dataTransfer.setData).toHaveBeenCalledOnce()
  })

  test('safely prevents a drag without a data transfer', () => {
    const library = useWorkflowLibraryDrag(true)
    const event = { dataTransfer: null, preventDefault: vi.fn() }
    library.startDrag(event as unknown as DragEvent, { type: 'control', kind: 'sync' }, 'sync')
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(library.draggingId.value).toBe('')
  })
})
