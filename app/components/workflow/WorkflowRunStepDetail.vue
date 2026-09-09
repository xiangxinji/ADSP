<script setup lang="ts">
import { isWorkflowControlNode, isWorkflowSubworkflowNode, workflowControlNames } from '#shared/utils/workflow-nodes'
import { workflowRunStatusLabels } from '#shared/config/workflow-run-status'
import type { WorkflowRun, WorkflowRunStep } from '#shared/types/workflow-runs'
import { formatWorkflowRunTime, workflowRunNodeLabel } from '~/utils/workflow-run-display'

const props = defineProps<{ run: WorkflowRun, step: WorkflowRunStep }>()
const emit = defineEmits<{ selectNode: [id: string] }>()
const {
  selectedIteration, selectedStep, selectedNode, legacyControl,
  selectedInputs, controlOutput, branchLabel, duration,
} = useWorkflowRunStepDetails(() => props.run, () => props.step)
const nodeLabel = (nodeId: string) => workflowRunNodeLabel(props.run, nodeId)
</script>

<template>
  <section v-if="selectedNode" class="workflow-run-detail" aria-label="节点执行结果">
    <h3>{{ nodeLabel(selectedStep.nodeId) }}</h3>
    <dl>
      <dt>开始时间</dt><dd>{{ formatWorkflowRunTime(selectedStep.startedAt) }}</dd>
      <dt>结束时间</dt><dd>{{ formatWorkflowRunTime(selectedStep.finishedAt) }}</dd>
      <dt>耗时</dt><dd>{{ duration }}</dd>
    </dl>
    <template v-if="step.executions?.length">
      <label for="workflow-run-iteration">逐项执行记录</label>
      <select id="workflow-run-iteration" v-model.number="selectedIteration" class="workflow-run-history">
        <option :value="-1">节点汇总 · {{ step.executions.length }} 次</option>
        <option
          v-for="(execution, index) in step.executions"
          :key="JSON.stringify(execution.iterationPath)"
          :value="index"
        >
          {{ execution.iterationPath.map(item => nodeLabel(item.nodeId) + ' 第 ' + (item.index + 1) + ' 项').join(' / ') }}
          · {{ workflowRunStatusLabels[execution.status] }}
        </option>
      </select>
      <p v-if="selectedIteration === -1">选择具体数组元素，查看该次执行独立的输入、输出和错误。</p>
    </template>
    <details>
      <summary>{{ isWorkflowControlNode(selectedNode) ? '迭代规则' : '配置输入' }}</summary>
      <pre>{{ JSON.stringify(selectedInputs, null, 2) }}</pre>
    </details>
    <details v-if="selectedStep.resolvedInputs">
      <summary>实际输入</summary>
      <pre>{{ JSON.stringify(selectedStep.resolvedInputs, null, 2) }}</pre>
    </details>
    <WorkflowNestedRun v-if="selectedStep.childRun" :key="selectedStep.childRun.id" :run="selectedStep.childRun" />
    <p v-else-if="isWorkflowSubworkflowNode(selectedNode) && selectedIteration === -1 && step.executions?.length">
      选择某一项执行记录，展开该次子工作流的内部状态。
    </p>
    <section v-if="controlOutput" class="workflow-control-results" aria-label="流程控制子流程结果">
      <p v-if="isWorkflowControlNode(selectedNode)">
        {{ workflowControlNames[selectedNode.kind] }}
        · {{ legacyControl ? '按历史端点顺序展示结果' : '按原数组顺序展示逐项结果' }}
      </p>
      <h4>执行出口：{{ controlOutput.selectedPort === 'complete' ? '完成' : '异常' }}</h4>
      <button
        v-for="branch in controlOutput.branches"
        :key="branch.index ?? branch.portId"
        type="button"
        @click="emit('selectNode', branch.failedNodeId || branch.nodeId)"
      >
        <strong>{{ branch.index === undefined ? branchLabel(branch.portId) : '第 ' + (branch.index + 1) + ' 项' }}</strong>
        <span class="workflow-run-status" :data-status="branch.status">{{ workflowRunStatusLabels[branch.status] }}</span>
        <small v-if="branch.error">{{ branch.error.code }} · {{ branch.error.message }}</small>
      </button>
    </section>
    <div
      v-if="selectedStep.error"
      class="alert"
      :class="selectedStep.status === 'handled' ? 'workflow-handled-error' : 'error-state'"
      :role="selectedStep.status === 'handled' ? 'status' : 'alert'"
    >
      <strong>{{ selectedStep.status === 'handled' ? '异常已处理 · ' : '' }}{{ selectedStep.error.code }}</strong>
      <p>{{ selectedStep.error.message }}</p>
    </div>
    <template v-if="selectedStep.output !== null">
      <h4>输出结果</h4><pre>{{ JSON.stringify(selectedStep.output, null, 2) }}</pre>
    </template>
    <p v-else-if="selectedStep.status === 'pending'">等待上游节点完成。</p>
    <p v-else-if="selectedStep.status === 'running'">当前节点正在执行，结果会自动更新。</p>
    <p v-else-if="selectedStep.status === 'skipped'">本节点未执行。</p>
  </section>
</template>
