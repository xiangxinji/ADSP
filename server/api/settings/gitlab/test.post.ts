import { testGitLabSettings } from '../../../services/gitlab'
import { gitLabSettingsPayload } from '../../../validation/gitlab'

export default defineEventHandler(async event => testGitLabSettings(
  gitLabSettingsPayload(await readBody(event)),
))
