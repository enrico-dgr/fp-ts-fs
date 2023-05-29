import { flow, pipe } from 'fp-ts/lib/function'
import fs from 'fs'
import * as A from 'fp-ts/Array'
import * as E from 'fp-ts/Either'
import { readFileSync } from './readFile'
import { bufferToString } from './utils'
import { readDirSync } from './readDir'
import path from 'path'

const recogniseGlobType = (
  pattern: string
): E.Either<Error, 'replace-dir' | 'replace-matching-file'> => {
  if (pattern === '**') {
    return E.right('replace-dir')
  } else if (!pattern.includes('*')) {
    return E.right('replace-matching-file')
  } else {
    return E.left(new Error('No valid glob'))
  }
}

const replaceDir = (o: {
  indexOfFirstGlob: number
  splittedPath: string[]
}): string[] => {
  let basePath = ''
  let dirNames = []
  const paths = []

  if (o.indexOfFirstGlob === 0) {
    basePath = '/'
  } else {
    basePath = o.splittedPath.slice(0, o.indexOfFirstGlob).join('/') + '/'
  }

  dirNames.push(
    ...fs
      .readdirSync(basePath, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((directory) => directory.name)
  )
  paths.push(...dirNames.map((dirName) => basePath + dirName))

  return paths
}

export const replaceFileName = (o: {
  indexOfFirstGlob: number
  splittedPath: string[]
}): string[] => {
  let basePath = ''
  let dirNames = []
  const paths = []

  // e.g. splittedPath = ['', 'mock', 'subdir', '*']

  if (o.indexOfFirstGlob === 0) {
    basePath = '/'
  } else {
    // basePath = '/mock/subdir/'
    basePath = o.splittedPath.slice(0, o.indexOfFirstGlob).join('/') + '/'
  }

  const fileRegex = new RegExp(
    o.splittedPath[o.indexOfFirstGlob].replace('*', '.*')
  )

  dirNames.push(
    ...fs
      // search all files in base path
      .readdirSync(basePath, { withFileTypes: true })
      // filter based on glob
      .filter((item) => item.isFile() && item.name.search(fileRegex) > -1)
      .map((file) => file.name)
  )

  paths.push(...dirNames.map((dirName) => basePath + dirName))

  return paths
}

const iterateThroughGlob = (o: {
  indexOfFirstGlob: number
  splittedPath: string[]
}): E.Either<Error, string[]> =>
  pipe(
    recogniseGlobType(o.splittedPath[o.indexOfFirstGlob]),
    E.map((globType) => {
      let paths = []

      switch (globType) {
        case 'replace-dir':
          paths.push(...replaceDir(o))
          break
        case 'replace-matching-file':
          paths.push(...replaceFileName(o))
          break
        default:
          break
      }

      return paths
    }),
    E.map((paths) =>
      paths
        .map((path) => queryPathAll(path))
        .flatMap(
          E.match(
            (e) => {
              throw e
            },
            (r) => r
          )
        )
    )
  )

const checkStandardPath = (path: string): E.Either<Error, string[]> => {
  if (!fs.existsSync(path)) {
    return E.left(new Error(`File does not exist: "${path}"`))
  } else if (fs.lstatSync(path).isFile()) {
    return E.right([path])
  } else {
    return E.left(new Error('Path does not correspond to a file: ' + path))
  }
}

const queryPathAll = (globPath: string): E.Either<Error, string[]> =>
  pipe(
    {
      splittedPath: globPath.split(/[\\\/]/),
    },
    ({ splittedPath }) => ({
      splittedPath,
      indexOfFirstGlob: splittedPath.findIndex((v) => v.includes('*')),
    }),
    (o) =>
      o.indexOfFirstGlob < 0
        ? checkStandardPath(globPath)
        : iterateThroughGlob(o)
  )

export const readFilesSync = flow(
  queryPathAll,
  E.map((paths) =>
    paths.map((path) => {
      const file = fs.readFileSync(path)
      const splittedPath = path.split('/')

      return {
        name: splittedPath[splittedPath.length - 1],
        content: file.toString(),
      }
    })
  )
)

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
  const basePath = splitted.slice(0, indexOfFirstPattern).join(SEPARATOR)
  let filesBasePath = path.join(...splitted.slice(0, indexOfFirstPattern))

  const completeDirentPath = (dirent: fs.Dirent) => {
    let suffix = ''
    let restOfPath = []

    if (dirent.isDirectory() && splitted.length > indexOfFirstPattern + 1) {
      restOfPath = splitted.slice(indexOfFirstPattern + 1)
      suffix = path.join('**', ...restOfPath)
    }

    return path.join(filesBasePath, dirent.name, suffix)
  }

  return pipe(
    readDirSync(basePath, { withFileTypes: true }),
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

const regexMatch = (splitted: string[], indexOfFirstPattern: number) => {
  const basePath = splitted.slice(0, indexOfFirstPattern).join(SEPARATOR)

  const testRegex = (dirent: fs.Dirent) => {
    const regex = new RegExp(splitted[indexOfFirstPattern])

    return regex.test(dirent.name)
  }

  const completeDirentPath = (dirent: fs.Dirent) => {
    let suffix = ''
    let restOfPath = ''

    if (dirent.isDirectory() && splitted.length > indexOfFirstPattern + 1) {
      restOfPath = splitted.slice(indexOfFirstPattern + 1).join('/')
      suffix = `${SEPARATOR}${restOfPath}`
    }

    return basePath + dirent.name + suffix
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

type FileInfos = {
  path: string
  content: string
}

const patternMatch = (splitted: string[], indexOfFirstPattern: number) =>
  splitted[indexOfFirstPattern].search(/^\*\*$/) > -1
    ? doubleStarMatch(splitted, indexOfFirstPattern)
    : regexMatch(splitted, indexOfFirstPattern)

export const splitPath = (path: string) => path.split(SEPARATOR)

const reduceEitherFileInfosArr = A.reduce<
  E.Either<Error, FileInfos[]>,
  E.Either<Error, FileInfos[]>
>(E.right<Error, FileInfos[]>([]), (eitherAcc, fileInfos_) =>
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

export const findPathMatches = (path: string): E.Either<Error, FileInfos[]> =>
  pipe(
    splitPath(path),
    (splitted) => ({
      splitted,
      indexOfFirstRegex: splitted.findIndex(testPatternPresence),
    }),
    ({ splitted, indexOfFirstRegex: indexOfFirstPattern }) =>
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

export const readFilesSyncNew = ({ paths }: Deps) =>
  pipe(paths, A.map(findPathMatches))
