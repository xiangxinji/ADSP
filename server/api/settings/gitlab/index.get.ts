import { getGitLabSettings } from '../../../utils/integration-settings'

export default defineEventHandler(() => getGitLabSettings())
