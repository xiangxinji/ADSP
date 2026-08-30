import { deleteGitLabSettings } from '../../../services/gitlab'

export default defineEventHandler((event) => {
  deleteGitLabSettings()
  setResponseStatus(event, 204)
  return null
})
