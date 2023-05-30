import { flow, pipe } from 'fp-ts/lib/function'
import fs from 'fs'
import * as A from 'fp-ts/Array'
import * as E from 'fp-ts/Either'
import { readFileSync } from './readFile'
import { bufferToString } from './utils'
import { readDirSync } from './readDir'
import path from 'path'

const SEPARATOR = process.platform === 'win32' ? '\\' : '/'

export const simplePathMatches = (path: string) =>
  pipe(
    readFileSync(path),
    E.chain(bufferToString),
    E.map((r) => [{ path, content: r }])
  )

export const doubleStarMatch = (
  splitted: string[],
  indexOfFirstPattern: number
) => {
  const basePath = path.join(...splitted.slice(0, indexOfFirstPattern))
  let restOfPath = '.*'

  if (splitted.length > indexOfFirstPattern + 1) {
    restOfPath = path.join(...splitted.slice(indexOfFirstPattern + 1))
  }

  const dirFiles = path.join(basePath, restOfPath)

  const completeDirentPath = (dirent: fs.Dirent) => {
    return path.join(basePath, dirent.name, '**', restOfPath)
  }

  return pipe(
    readDirSync(basePath, { withFileTypes: true }),
    E.map(A.filter((dirent) => dirent.isDirectory())),
    E.map(
      A.map((dirent) =>
        E.tryCatch(
          () => completeDirentPath(dirent),
          (e) => {
            const err = e as Error
            return err
          }
        )
      )
    ),
    E.chain(
      A.reduce(E.right<Error, string[]>([]), (pathsAccumulator, path_) =>
        pipe(
          pathsAccumulator,
          E.map((paths) =>
            pipe(
              path_,
              E.reduce(paths, (paths_, path) => [...paths_, path])
            )
          )
        )
      )
    ),
    E.map((arr) => [...arr, dirFiles])
  )
}

export const regexMatch = (splitted: string[], indexOfFirstPattern: number) => {
  const basePath = path.join(...splitted.slice(0, indexOfFirstPattern))

  const testRegex = (dirent: fs.Dirent) => {
    const regex = new RegExp(splitted[indexOfFirstPattern])

    return regex.test(dirent.name)
  }

  const completeDirentPath = (dirent: fs.Dirent) => {
    let suffix = ''
    let restOfPath = ''

    if (dirent.isDirectory() && splitted.length > indexOfFirstPattern + 1) {
      restOfPath = path.join(...splitted.slice(indexOfFirstPattern + 1))
      suffix = restOfPath
    }

    return path.join(basePath, dirent.name, suffix)
  }

  return pipe(
    readDirSync(basePath, { withFileTypes: true }),
    E.map(A.filter(testRegex)),
    E.map(
      A.map((dirent) =>
        E.tryCatch(
          () => completeDirentPath(dirent),
          (e) => {
            const err = e as Error
            return err
          }
        )
      )
    ),
    E.chain(
      A.reduce(E.right<Error, string[]>([]), (pathsAccumulator, path_) =>
        pipe(
          pathsAccumulator,
          E.map((paths) =>
            pipe(
              path_,
              E.reduce(paths, (paths_, path) => [...paths_, path])
            )
          )
        )
      )
    )
  )
}

export const testPatternPresence = (str: string) => /[\*\(\)]/.test(str)

export type FileInfo = {
  path: string
  content: string
}

const patternMatch = (splitted: string[], indexOfFirstPattern: number) =>
  splitted[indexOfFirstPattern].search(/^\*\*$/) > -1
    ? doubleStarMatch(splitted, indexOfFirstPattern)
    : regexMatch(splitted, indexOfFirstPattern)

export const splitPath = (path: string) => path.split(SEPARATOR)

const reduceEitherFileInfosArr = A.reduce<
  E.Either<Error, FileInfo[]>,
  E.Either<Error, FileInfo[]>
>(E.right<Error, FileInfo[]>([]), (eitherAcc, fileInfos_) =>
  pipe(
    eitherAcc,
    E.map((fileInfosAcc) =>
      pipe(
        fileInfos_,
        E.reduce(fileInfosAcc, (fileInfosAcc_, f) => [...fileInfosAcc_, ...f])
      )
    )
  )
)

export const findPathMatches = (path: string): E.Either<Error, FileInfo[]> =>
  pipe(
    splitPath(path),
    (splitted) => ({
      splitted,
      indexOfFirstPattern: splitted.findIndex(testPatternPresence),
    }),
    ({ splitted, indexOfFirstPattern }) =>
      indexOfFirstPattern < 0
        ? simplePathMatches(path)
        : pipe(
            patternMatch(splitted, indexOfFirstPattern),
            E.chain(flow(A.map(findPathMatches), reduceEitherFileInfosArr))
          )
  )

type Deps = {
  paths: string[]
}

export const readFilesSync = ({ paths }: Deps) =>
  pipe(paths, A.map(findPathMatches), reduceEitherFileInfosArr)
