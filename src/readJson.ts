import fs from 'fs'
import { pipe } from 'fp-ts/function'
import { ReadSyncOptions, readFileSync } from './readFile'
import * as E from 'fp-ts/Either'
import * as logger from '@enrico-dgr/fp-ts-logger'

const toJson = (fileContent: string) => 
E.tryCatch(
  () =>
    JSON.parse(fileContent),
  logger.parseUnknownError(`Could not parse file's content into Object.`)
)

export const readJsonSync = (
  file: fs.PathOrFileDescriptor,
  options: ReadSyncOptions
) =>
  pipe(
    readFileSync(file, options),
    E.chain((a) =>
      E.tryCatch(
        () =>
          a instanceof Buffer
            ? a.toString(
                typeof options === 'string'
                  ? options
                  : options.encoding ?? 'utf-8'
              )
            : a,
        logger.parseUnknownError(`Could not parse file's content into string.`)
      )
    )
  )
