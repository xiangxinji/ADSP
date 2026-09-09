# 工作流节点库

ForgePilot · 铸航的左侧节点面板采用紧凑布局，保持原有画布宽度和节点添加契约。

## 布局与交互

- **根触发器**：已有触发器时收起为当前入口摘要，点击展开切换；未配置时自动展开选择。仍然必须有且只能有一个根触发器。
- **流程节点**：工作流复用、同步执行、异步执行采用三列小宫格，用图标、颜色和名称区分职责，详细说明按需展示。
- **资产操作**：按仓库、成员、环境、知识筛选；操作分组可以独立折叠。分类和操作始终来自共享资产操作契约，仅展示允许工作流执行的命令。
- **搜索**：匹配名称、功能说明和操作 ID，不区分大小写；空格分隔的关键词同时匹配。搜索与当前资产分类组合生效，无结果时可重置筛选。
- **搜索与折叠**：搜索期间展开所有匹配分组，避免结果被折叠隐藏；清空搜索后恢复此前折叠状态。
- **说明**：列表省略重复资产前缀和长说明，悬停或键盘聚焦时在面板底部浮出说明，不额外占用列表高度；完整说明也保留在原生提示和无障碍描述中。
- **添加**：按钮支持点击和键盘添加，拖动仍通过原有 MIME 数据传入画布。未选择根触发器时禁止添加和拖动。
- **滚动**：资产操作列表独立滚动，搜索与分类入口保持可见；窄屏限制列表高度，避免长列表挤走画布。

## 实现边界

`WorkflowNodeLibrary` 负责面板与说明预览；`WorkflowTriggerPicker`、`WorkflowFlowNodeLibrary`、`WorkflowOperationLibrary` 分别负责入口选择、流程节点与资产操作。筛选和拖动状态由独立 composable 管理。不修改工作流执行逻辑、资产命令契约、API 或持久化结构。

## 验证

- `npx vitest run tests/workflow-node-library.spec.ts tests/workflow-node-drag.spec.ts tests/workflow-operation-editor.spec.ts tests/workflow-control-editor.spec.ts tests/workflow-subworkflow-editor.spec.ts tests/architecture.spec.ts`
- `npm run build`
- 浏览器检查已配置/未配置触发器、点击/拖入添加、分类、关键词、空结果重置、分组折叠、键盘焦点、浅色/深色及窄屏布局。
