import fs from 'fs'
import * as E from 'fp-ts/Either'
import * as logger from '@enrico-dgr/fp-ts-logger'

type ReadSyncOptions_ = Exclude<
  Parameters<typeof fs.readFileSync>[1],
  null | undefined
>

type EncodingType = Extract<ReadSyncOptions_, string>
type OptionsObj = Exclude<ReadSyncOptions_, EncodingType>

export type ReadSyncOptions<O extends {} = {}> = (OptionsObj & O) | EncodingType

export const readFileSync = (
  file: fs.PathOrFileDescriptor,
  options?: ReadSyncOptions
) =>
  E.tryCatch(
    () => fs.readFileSync(file, options),
    logger.parseUnknownError(`Could not read file synchronously.`)
  )
