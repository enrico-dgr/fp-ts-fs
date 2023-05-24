import fs from 'fs'
import { pipe } from 'fp-ts/function'
import { ReadSyncOptions, readFileSync } from './readFile'
import * as E from 'fp-ts/Either'
import * as logger from '@enrico-dgr/fp-ts-logger'
import { bufferToString } from './utils'

const toJson = (fileContent: string) =>
  E.tryCatch(
    () => JSON.parse(fileContent) as Object,
    logger.parseUnknownError(`Could not parse file's content into Object.`)
  )

export const readJsonSync = (
  file: fs.PathOrFileDescriptor,
  options?: ReadSyncOptions
) =>
  pipe(
    readFileSync(file, options),
    E.chain((fileContent) => bufferToString(fileContent, options)),
    E.chain(toJson)
  )
