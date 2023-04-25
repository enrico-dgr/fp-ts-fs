import fs from 'fs'
import * as E from 'fp-ts/Either'
import * as logger from '@enrico-dgr/fp-ts-logger'

export type ReadSyncOptions = Exclude<Parameters<typeof fs.readFileSync>[1], null | undefined>

export const readFileSync = (
  file: fs.PathOrFileDescriptor,
  options?: ReadSyncOptions
) =>
  E.tryCatch(
    () => fs.readFileSync(file, options),
    logger.parseUnknownError(`Could not read file synchronously.`)
  )
