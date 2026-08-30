import { useDatabase } from '../utils/database'

export const runInTransaction = <T>(work: () => T) => useDatabase().transaction(work)()
