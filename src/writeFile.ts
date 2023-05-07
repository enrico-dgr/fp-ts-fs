import fs from 'fs'
import * as E from 'fp-ts/Either'

export default (
  file: fs.PathOrFileDescriptor,
  data: string | NodeJS.ArrayBufferView,
  options?: fs.WriteFileOptions
) =>
  E.tryCatch(
    () => fs.writeFileSync(file, data, options),
    (e) => {
      const err = e as Error

      return new Error(err.stack ?? `Cannot write data into file "${file}"`)
    }
  )
