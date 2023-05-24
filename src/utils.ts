import { ReadSyncOptions } from './readFile'
import * as E from 'fp-ts/Either'
import * as logger from '@enrico-dgr/fp-ts-logger'

export const bufferToString = (
  fileContent: string | Buffer,
  options?: ReadSyncOptions
) =>
  E.tryCatch(
    () =>
      fileContent instanceof Buffer
        ? fileContent.toString(
            typeof options === 'string' ? options : options?.encoding ?? 'utf-8'
          )
        : fileContent,
    logger.parseUnknownError(`Could not parse file's content into string.`)
  )