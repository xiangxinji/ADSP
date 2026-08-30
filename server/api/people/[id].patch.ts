import type { UpdatePersonInput } from '../../../shared/types/asdp'
import { updatePerson } from '../../utils/asdp-store'
import { personPayload } from '../../utils/payloads'

export default defineEventHandler(async (event) => updatePerson(
  getRouterParam(event, 'id') || '',
  personPayload(await readBody(event), true) as UpdatePersonInput,
))
