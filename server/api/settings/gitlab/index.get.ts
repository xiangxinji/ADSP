import { getGitLabSettings } from '../../../services/gitlab'

export default defineEventHandler(() => getGitLabSettings())
