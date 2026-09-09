import { nextTick, ref } from 'vue'
import type { WorkflowNodePosition } from '#shared/types/asdp'
import { hasWorkflowNodeDragData, readWorkflowNodeDragData, type WorkflowNodeDropData } from '../utils/workflow-node-drag'

export const useWorkflowNodeDrop = (
  readOnly: () => boolean | undefined,
  toFlowPosition: (position: WorkflowNodePosition) => WorkflowNodePosition,
  addNode: (data: WorkflowNodeDropData) => void,
) => {
  const dragOver = ref(false)
  const skipNextNodeFit = ref(false)
  const acceptsDrop = (event: DragEvent) => !readOnly() && hasWorkflowNodeDragData(event.dataTransfer)
  const onDragOver = (event: DragEvent) => {
    if (!acceptsDrop(event)) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    dragOver.value = true
  }
  const onDragLeave = (event: DragEvent) => {
    const canvas = event.currentTarget as HTMLElement
    if (event.relatedTarget && canvas.contains(event.relatedTarget as Node)) return
    dragOver.value = false
  }
  const onDrop = (event: DragEvent) => {
    dragOver.value = false
    if (!acceptsDrop(event)) return
    const data = readWorkflowNodeDragData(event.dataTransfer)
    if (!data) return
    event.preventDefault()
    const point = toFlowPosition({ x: event.clientX, y: event.clientY })
    const position = { x: point.x - (data.type === 'workflow' ? 134 : 114), y: point.y - 43 }
    skipNextNodeFit.value = true
    addNode({ ...data, position })
    nextTick(() => { skipNextNodeFit.value = false })
  }
  return { dragOver, skipNextNodeFit, onDragOver, onDragLeave, onDrop }
}
