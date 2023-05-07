import { pipe } from 'fp-ts/function'
import * as E from 'fp-ts/Either'
import * as A from 'fp-ts/Array'
import { readJsonSync } from './readJson'
import fs from 'fs'
import { ReadSyncOptions } from './readFile'
import writeFile from './writeFile'

type Deps = {
  paths: fs.PathOrFileDescriptor[]
  options?: ReadSyncOptions<{ format?: boolean }>
  output: fs.PathOrFileDescriptor
}

const assignJson = ({ paths, options, output }: Deps) =>
  pipe(
    paths,
    A.map((path) => readJsonSync(path, options)),
    A.reduce(E.right<Error, Object>({}), (jsonB, jsonA) =>
      pipe(
        jsonA,
        E.chain((a) =>
          pipe(
            jsonB,
            E.map((b) => ({ ...b, ...a }))
          )
        )
      )
    ),
    E.map((jsonObj) =>
      JSON.stringify(
        jsonObj,
        null,
        typeof options !== 'string' && !!options?.format ? '\t' : undefined
      )
    ),
    E.chain((jsonStr) => writeFile(output, jsonStr))
  )

export default assignJson
