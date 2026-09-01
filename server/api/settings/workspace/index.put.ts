import { updateLocalWorkspaceSettings } from '../../../services/local-workspace-settings'
import { localWorkspaceSettingsPayload } from '../../../validation/local-workspace-settings'

export default defineEventHandler(async event => updateLocalWorkspaceSettings(
  localWorkspaceSettingsPayload(await readBody(event)),
))
