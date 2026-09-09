import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useRepositoryAssetActions } from '../app/composables/useRepositoryAssetActions'
import { assetOperationsForModule } from '../shared/config/asset-operations'
import { repositoryListItem } from './support/workflow-fixtures'

const { success } = vi.hoisted(() => ({ success: vi.fn() }))
vi.mock('../app/composables/useAppToast', () => ({ useAppToast: () => ({ success }) }))

const fetchMock = vi.fn()
const promptMock = vi.fn()
const repository = repositoryListItem('repository-1')
const operation = (id: string) => assetOperationsForModule('repositories').find(item => item.id === id)!
const setup = () => {
  const onRefresh = vi.fn()
  const onEdit = vi.fn()
  return { ...useRepositoryAssetActions({ onRefresh, onEdit }), onRefresh, onEdit }
}

describe('repository asset actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    promptMock.mockReset()
    vi.stubGlobal('$fetch', fetchMock)
    vi.stubGlobal('window', { prompt: promptMock })
  })
  afterEach(() => vi.unstubAllGlobals())

  test('keeps command progress until the response and refreshes the asset list', async () => {
    let resolveCommand: (value: unknown) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveCommand = resolve }))
    const state = setup()
    state.actionError.value = 'previous error'
    const pending = state.runOperation(repository, operation('repository.clone'))
    expect(state.runningOperation.value).toEqual({ id: repository.id, operationId: 'repository.clone' })
    expect(state.actionError.value).toBe('')
    expect(state.onRefresh).not.toHaveBeenCalled()
    resolveCommand({ repositoryId: repository.id, path: '/workspace/repository' })
    await pending
    expect(state.runningOperation.value).toBeNull()
    expect(state.onRefresh).toHaveBeenCalledOnce()
    expect(success).toHaveBeenCalledWith(expect.stringContaining('/workspace/repository'))
    expect(fetchMock).toHaveBeenCalledWith(`/api/assets/repository/${repository.id}/operations/repository.clone`, {
      method: 'POST', body: undefined,
    })
  })

  test.each([
    ['repository.create-worktree', ['feature/test'], { branch: 'feature/test' }],
    ['repository.create-branch', ['main', 'feature/test'], { source: 'main', branch: 'feature/test' }],
    ['repository.create-merge-request', ['feature/test', 'main', 'Test MR'], { source: 'feature/test', target: 'main', title: 'Test MR' }],
  ])('collects the existing command inputs for %s', async (id, answers, body) => {
    answers.forEach(answer => promptMock.mockReturnValueOnce(answer))
    fetchMock.mockResolvedValueOnce({ repositoryId: repository.id, path: '/workspace/repository' })
    const state = setup()
    await state.runOperation(repository, operation(id))
    expect(fetchMock).toHaveBeenCalledWith(`/api/assets/repository/${repository.id}/operations/${id}`, { method: 'POST', body })
    expect(promptMock).toHaveBeenCalledTimes(answers.length)
  })

  test.each([
    ['repository.create-worktree', []],
    ['repository.create-branch', []],
    ['repository.create-branch', ['main']],
    ['repository.create-merge-request', []],
    ['repository.create-merge-request', ['feature/test']],
    ['repository.create-merge-request', ['feature/test', 'main']],
  ])('does not execute %s when an input is cancelled or blank (%j)', async (id, previousAnswers) => {
    for (const answer of [null, '  ']) {
      promptMock.mockReset()
      previousAnswers.forEach(value => promptMock.mockReturnValueOnce(value))
      promptMock.mockReturnValueOnce(answer)
      const state = setup()
      await state.runOperation(repository, operation(id))
      expect(fetchMock).not.toHaveBeenCalled()
      expect(state.runningOperation.value).toBeNull()
      expect(state.actionError.value.length > 0).toBe(answer !== null)
      expect(state.onRefresh).not.toHaveBeenCalled()
    }
  })

  test.each([
    [{ cloned: true, path: '/repo' }, '本地已克隆：/repo'],
    [{ cloned: false, path: '/repo' }, '本地尚未克隆：/repo'],
    [{ branch: 'feature/test', source: 'main' }, '远程分支已创建：feature/test（基于 main）'],
    [{ mergeRequestId: '1', mergeRequestNumber: '42', title: 'Test' }, '合并请求 !42 已创建：Test'],
  ])('preserves command-specific success feedback for %j', async (result, message) => {
    fetchMock.mockResolvedValueOnce({ repositoryId: repository.id, ...result })
    await setup().runOperation(repository, operation('repository.clone'))
    expect(success).toHaveBeenCalledWith(message)
  })

  test('refreshes persisted progress after failure without leaving a busy command', async () => {
    fetchMock.mockRejectedValueOnce({ data: { statusMessage: '仓库不可用' } })
    const state = setup()
    await state.runOperation(repository, operation('repository.clone'))
    expect(state.actionError.value).toBe('仓库不可用')
    expect(state.runningOperation.value).toBeNull()
    expect(state.onRefresh).toHaveBeenCalledOnce()
    expect(success).not.toHaveBeenCalled()
  })

  test('keeps edit and delete confirmation outside workflow command requests', async () => {
    const state = setup()
    await state.runOperation(repository, operation('repository.edit'))
    expect(state.onEdit).toHaveBeenCalledWith(repository)
    await state.runOperation(repository, operation('repository.delete'))
    expect(state.deletingRepository.value).toEqual(repository)
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockResolvedValueOnce(undefined)
    await state.removeRepository()
    expect(fetchMock).toHaveBeenCalledWith(`/api/repositories/${repository.id}`, { method: 'DELETE' })
    expect(state.deletingRepository.value).toBeNull()
    expect(state.deleting.value).toBe(false)
    expect(state.onRefresh).toHaveBeenCalledOnce()
  })

  test('keeps a failed deletion available for retry and ignores missing selections', async () => {
    const state = setup()
    await state.removeRepository()
    expect(fetchMock).not.toHaveBeenCalled()
    state.deletingRepository.value = repository
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await state.removeRepository()
    expect(state.deletingRepository.value).toEqual(repository)
    expect(state.actionError.value).toBe('offline')
    expect(state.deleting.value).toBe(false)
    expect(state.onRefresh).not.toHaveBeenCalled()
  })
})
