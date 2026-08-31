export type KnowledgeReferenceMarkdownNode = {
  type: string
  value?: string
  children?: KnowledgeReferenceMarkdownNode[]
  assetType?: string
  recordId?: string
  raw?: string
  [key: string]: unknown
}

const referencePattern = /\[\[([^\[\]：:]+?)\s*[：:]\s*([^\[\]]+?)\]\]/g

export const createKnowledgeReferenceToken = (assetType: string, recordId: string) =>
  `[[${assetType}:${recordId}]]`

export const splitKnowledgeReferenceText = (value: string): KnowledgeReferenceMarkdownNode[] => {
  const nodes: KnowledgeReferenceMarkdownNode[] = []
  let cursor = 0

  for (const match of value.matchAll(referencePattern)) {
    const index = match.index ?? 0
    if (index > cursor) nodes.push({ type: 'text', value: value.slice(cursor, index) })

    const raw = match[0]
    nodes.push({
      type: 'assetReference',
      assetType: match[1].trim(),
      recordId: match[2].trim(),
      raw,
    })
    cursor = index + raw.length
  }

  if (!nodes.length) return [{ type: 'text', value }]
  if (cursor < value.length) nodes.push({ type: 'text', value: value.slice(cursor) })
  return nodes
}

export const transformKnowledgeReferenceTree = (node: KnowledgeReferenceMarkdownNode) => {
  if (!node.children) return node

  node.children = node.children.flatMap((child) => {
    if (child.type === 'text' && typeof child.value === 'string') {
      return splitKnowledgeReferenceText(child.value)
    }
    transformKnowledgeReferenceTree(child)
    return child
  })
  return node
}
