import { beforeEach, describe, expect, test, vi } from 'vitest'
import { findWorkflowDefinition } from '../server/repositories/workflow-definitions'
import { listWorkflowRuns } from '../server/repositories/workflow-runs'
import { useDatabase } from '../server/utils/database'
import { analyzeWorkflowGraph } from '../shared/utils/workflow-graph'
import { asyncNode, operationNode, runFixture, workflowEdge as edge } from './support/workflow-fixtures'

vi.mock('../server/utils/database', () => ({ useDatabase: vi.fn() }))

describe.each(['sync', 'async'] as const)('%s legacy control definitions', kind => {
  const legacy = (multiple: boolean) => runFixture([
    { ...asyncNode(), kind, branches: [{ id: 'first', label: '旧端点一' }, { id: 'second', label: '旧端点二' }] },
    operationNode('child'), ...(multiple ? [operationNode('other')] : []),
  ], [edge('workflow-trigger', 'parallel'), edge('parallel', 'child', 'first'), ...(multiple ? [edge('parallel', 'other', 'second')] : [])])
  beforeEach(() => vi.resetAllMocks())

  test.each([false, true])('maps legacy handles without losing nodes, edges or historical snapshots (multiple=%s)', multiple => {
    const run = legacy(multiple)
    const definition = run.workflow
    const stored = {
      id: definition.id, project_id: definition.projectId, name: definition.name, note: '',
      trigger_kind: 'manual', trigger_x: 0, trigger_y: 0,
      nodes_json: JSON.stringify(definition.nodes), edges_json: JSON.stringify(definition.edges),
      created_at: '', updated_at: '',
    }
    const original = structuredClone(stored)
    vi.mocked(useDatabase).mockReturnValue({ prepare: () => ({ get: () => stored, all: () => [{
      id: run.id, workflow_id: run.workflowId, definition_json: JSON.stringify(definition),
      steps_json: JSON.stringify({ root: run.root, steps: run.steps }), status: run.status, started_at: '', finished_at: null,
    }] }) } as unknown as ReturnType<typeof useDatabase>)
    const migrated = findWorkflowDefinition(definition.id)!
    expect(migrated.nodes).toHaveLength(definition.nodes.length)
    expect(migrated.edges.map(connection => connection.id)).toEqual(definition.edges.map(connection => connection.id))
    expect(migrated.edges.filter(connection => connection.source === 'parallel').every(connection => connection.sourceHandle === 'item')).toBe(true)
    const validation = analyzeWorkflowGraph(migrated.nodes, migrated.edges, true)
    expect(validation.message).toBe(multiple ? '每个输出端点只能连接一个下游节点。' : '')
    expect(stored).toEqual(original)
    expect(listWorkflowRuns(definition.id)[0]!.workflow).toEqual(definition)
  })
})
