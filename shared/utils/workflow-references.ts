import type { WorkflowDefinition } from '../types/asdp'
import { isWorkflowSubworkflowNode } from './workflow-nodes'

export const workflowNestingLimit = 8

export const analyzeWorkflowReferences = (
  workflow: WorkflowDefinition,
  findWorkflow: (id: string) => WorkflowDefinition | null | undefined,
) => {
  const definitions = new Map<string, WorkflowDefinition>()
  const visiting = new Set<string>()
  const heights = new Map<string, number>()
  let error: { code: string, message: string } | null = null
  const visit = (current: WorkflowDefinition, depth: number): number => {
    if (visiting.has(current.id)) {
      error = { code: 'workflow.subworkflow-cycle', message: '工作流不能调用自身或形成循环调用。' }
      return 0
    }
    if (depth > workflowNestingLimit) {
      error = { code: 'workflow.subworkflow-depth-exceeded', message: `工作流嵌套最多支持 ${workflowNestingLimit} 层（包含当前工作流）。` }
      return 0
    }
    const cached = heights.get(current.id)
    if (cached !== undefined) return cached
    definitions.set(current.id, current)
    visiting.add(current.id)
    let height = 1
    for (const node of current.nodes.filter(isWorkflowSubworkflowNode)) {
      const child = node.workflowId === workflow.id ? workflow : findWorkflow(node.workflowId)
      if (!child) {
        error = { code: 'workflow.subworkflow-not-found', message: `节点“${node.label}”引用的子工作流不存在。` }
        break
      }
      if (child.projectId !== workflow.projectId) {
        error = { code: 'workflow.subworkflow-project-mismatch', message: '子工作流必须属于当前项目。' }
        break
      }
      height = Math.max(height, visit(child, depth + 1) + 1)
      if (error) break
    }
    visiting.delete(current.id)
    heights.set(current.id, height)
    return height
  }
  if (visit(workflow, 1) > workflowNestingLimit && !error) {
    error = { code: 'workflow.subworkflow-depth-exceeded', message: `工作流嵌套最多支持 ${workflowNestingLimit} 层（包含当前工作流）。` }
  }
  return { workflows: [...definitions.values()], error }
}
