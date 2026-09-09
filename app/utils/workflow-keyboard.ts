type WorkflowKeyboardEvent = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'target'>

export const shouldDeleteSelectedWorkflowNode = (event: WorkflowKeyboardEvent) => {
  if (event.key !== 'Backspace' || event.altKey || event.ctrlKey || event.metaKey) return false
  const target = event.target as (EventTarget & {
    isContentEditable?: boolean
    closest?: (selector: string) => Element | null
  }) | null
  return !target?.isContentEditable
    && !target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
}
