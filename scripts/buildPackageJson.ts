import { pipe } from 'fp-ts/function'
import * as E from 'fp-ts/Either'
import assignJson from '../src/assignJson'
import { logger  } from '@enrico-dgr/fp-ts-logger'
import path from 'path'

const PKG_CURRENT = path.resolve(__dirname, '../package.json')
const PKG_OVERRIDE = path.resolve(__dirname, '../package.override.json')
const PKG_NEW = path.resolve(__dirname, '../dist/package.json')

pipe(
  assignJson({
    paths: [PKG_CURRENT, PKG_OVERRIDE],
    output: PKG_NEW,
    options: { format: true }
  }),
  E.match(logger.error, () => {})
)
