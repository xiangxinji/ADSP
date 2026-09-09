import { describe, expect, test } from 'vitest'
import { shouldDeleteSelectedWorkflowNode } from '../app/utils/workflow-keyboard'

const keyboardEvent = (overrides: Partial<Parameters<typeof shouldDeleteSelectedWorkflowNode>[0]> = {}) => ({
  key: 'Backspace',
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  target: null,
  ...overrides,
})

describe('workflow node delete shortcut', () => {
  test('accepts an unmodified Backspace outside editable controls', () => {
    expect(shouldDeleteSelectedWorkflowNode(keyboardEvent())).toBe(true)
    expect(shouldDeleteSelectedWorkflowNode(keyboardEvent({ target: { closest: () => null } as EventTarget }))).toBe(true)
  })

  test('ignores typing targets and unrelated shortcuts', () => {
    const input = { closest: () => ({}) } as unknown as EventTarget
    const editor = { isContentEditable: true } as unknown as EventTarget
    expect(shouldDeleteSelectedWorkflowNode(keyboardEvent({ target: input }))).toBe(false)
    expect(shouldDeleteSelectedWorkflowNode(keyboardEvent({ target: editor }))).toBe(false)
    expect(shouldDeleteSelectedWorkflowNode(keyboardEvent({ key: 'Delete' }))).toBe(false)
    expect(shouldDeleteSelectedWorkflowNode(keyboardEvent({ ctrlKey: true }))).toBe(false)
  })
})
