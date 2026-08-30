import { updateGitLabSettings } from '../../../services/gitlab'
import { gitLabSettingsPayload } from '../../../validation/gitlab'

export default defineEventHandler(async event => updateGitLabSettings(
  gitLabSettingsPayload(await readBody(event)),
))
