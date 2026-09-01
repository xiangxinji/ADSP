import { getLocalWorkspaceSettings } from '../../../services/local-workspace-settings'

export default defineEventHandler(() => getLocalWorkspaceSettings())
