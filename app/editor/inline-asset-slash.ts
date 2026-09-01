export type InlineAssetSlashMatch = {
  slashOffset: number
  query: string
}

export const findInlineAssetSlashMatch = (textBeforeCursor: string): InlineAssetSlashMatch | null => {
  const slashOffset = textBeforeCursor.lastIndexOf('/')
  if (slashOffset <= 0) return null

  const previousCharacter = textBeforeCursor[slashOffset - 1]
  if (previousCharacter && [':', '/', '\\'].includes(previousCharacter)) return null

  const query = textBeforeCursor.slice(slashOffset + 1)
  if (query.length > 80 || /\s|\uFFFC/.test(query)) return null

  return { slashOffset, query }
}

export const matchesInlineAssetSlashQuery = (
  option: { typeLabel: string; label: string; detail: string },
  query: string,
) => {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return true

  return [option.typeLabel, option.label, option.detail]
    .some(value => value.toLocaleLowerCase().includes(normalizedQuery))
}
