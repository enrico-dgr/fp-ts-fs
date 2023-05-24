import fs from 'fs'
import * as E from 'fp-ts/Either'
import * as logger from '@enrico-dgr/fp-ts-logger'

type ReadSyncOptions_ = Exclude<
  Parameters<typeof fs.readdirSync>[1],
  null | undefined
>

type EncodingType = Extract<ReadSyncOptions_, string>
type OptionsObj = Exclude<ReadSyncOptions_, EncodingType>

export type ReadSyncOptions<O extends {} = {}> = (OptionsObj & O) | EncodingType

export const readDirSync = (
  file: fs.PathLike,
  options?: ReadSyncOptions
) =>
  E.tryCatch(
    () => fs.readdirSync(file, options as ReadSyncOptions), // needed to fix 'undefined' possibility
    logger.parseUnknownError(`Could not read dir synchronously.`)
  )
