import { deleteGitLabSettings } from '../../../utils/integration-settings'

export default defineEventHandler((event) => {
  deleteGitLabSettings()
  setResponseStatus(event, 204)
  return null
})
