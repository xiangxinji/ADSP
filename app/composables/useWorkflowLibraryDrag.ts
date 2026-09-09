import { ref, toValue, type MaybeRefOrGetter } from 'vue'
import { serializeWorkflowNodeDragData, workflowNodeDragMime, type WorkflowNodeDragData } from '../utils/workflow-node-drag'

export const useWorkflowLibraryDrag = (enabled: MaybeRefOrGetter<boolean>) => {
  const draggingId = ref('')
  const finishDrag = () => { draggingId.value = '' }
  const startDrag = (event: DragEvent, data: WorkflowNodeDragData, id: string) => {
    if (!toValue(enabled) || !event.dataTransfer) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(workflowNodeDragMime, serializeWorkflowNodeDragData(data))
    draggingId.value = id
  }
  return { draggingId, startDrag, finishDrag }
}
