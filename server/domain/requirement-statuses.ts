export const defaultRequirementStatuses = [
  { key: 'draft', name: '草稿', color: '#667085', sortOrder: 10, isInitial: true, isTerminal: false },
  { key: 'clarifying', name: '澄清中', color: '#b54708', sortOrder: 20, isInitial: false, isTerminal: false },
  { key: 'ready', name: '已就绪', color: '#2563eb', sortOrder: 30, isInitial: false, isTerminal: false },
  { key: 'in_progress', name: '执行中', color: '#7c3aed', sortOrder: 40, isInitial: false, isTerminal: false },
  { key: 'validating', name: '验证中', color: '#0891b2', sortOrder: 50, isInitial: false, isTerminal: false },
  { key: 'delivered', name: '已交付', color: '#079455', sortOrder: 60, isInitial: false, isTerminal: true },
] as const
