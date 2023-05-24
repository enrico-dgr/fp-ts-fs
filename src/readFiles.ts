import { flow, pipe } from 'fp-ts/lib/function'
import fs from 'fs'
import * as A from 'fp-ts/Array'
import * as E from 'fp-ts/Either'
import { readFileSync } from './readFile'
import { bufferToString } from './utils'
import { readDirSync } from './readDir'

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

export const simplePathMatches = (path: string) =>
  pipe(
    readFileSync(path),
    E.chain(bufferToString),
    E.match(
      () => [], // Ignoring error. E.g. It's the path of a directory
      (r) => [{ path, content: r }]
    )
  )

export const doubleStarMatch = (
  splitted: string[],
  indexOfFirstPattern: number
) => {
  const basePath = '/' + splitted.slice(0, indexOfFirstPattern).join('/')

  const completeDirentPath = (dirent: fs.Dirent) => {
    let suffix = ''
    let restOfPath = ''

    if (dirent.isDirectory() && splitted.length > indexOfFirstPattern + 1) {
      restOfPath = splitted.slice(indexOfFirstPattern + 1).join('/')
      suffix = `/**/${restOfPath}`
    }

    return basePath + dirent.name + suffix
  }

  return pipe(
    readDirSync(basePath, { withFileTypes: true }),
    E.match(() => [], A.map(completeDirentPath))
  )
}

const regexMatch = (splitted: string[], indexOfFirstPattern: number) => {
  const basePath = splitted.slice(0, indexOfFirstPattern).join('/')

  const testRegex = (dirent: fs.Dirent) => {
    const regex = new RegExp(splitted[indexOfFirstPattern])

    return regex.test(dirent.name)
  }

  const completeDirentPath = (dirent: fs.Dirent) => {
    let suffix = ''
    let restOfPath = ''

    if (dirent.isDirectory() && splitted.length > indexOfFirstPattern + 1) {
      restOfPath = splitted.slice(indexOfFirstPattern + 1).join('/')
      suffix = `/${restOfPath}`
    }

    return basePath + dirent.name + suffix
  }

  return pipe(
    readDirSync(basePath, { withFileTypes: true }),
    E.map(A.filter(testRegex)),
    E.match((_e) => [], A.map(completeDirentPath))
  )
}

const testPatternPresence = (str: string) => /[\*\(\)]/.test(str)

type FileInfos = {
  path: string
  content: string
}

const patternMatch = (splitted: string[], indexOfFirstPattern: number) =>
  splitted[indexOfFirstPattern].search(/^\*\*$/) > -1
    ? doubleStarMatch(splitted, indexOfFirstPattern)
    : regexMatch(splitted, indexOfFirstPattern)

export const findPathMatches = (path: string): FileInfos[] =>
  pipe(
    path.split('\\/'),
    (splitted) => ({
      splitted,
      indexOfFirstRegex: splitted.findIndex(testPatternPresence),
    }),
    ({ splitted, indexOfFirstRegex: indexOfFirstPattern }) =>
      indexOfFirstPattern < 0
        ? simplePathMatches(path)
        : pipe(
            patternMatch(splitted, indexOfFirstPattern),
            A.flatMap(findPathMatches)
          ),
    () => []
  )

type Deps = {
  paths: string[]
}

export const readFilesSyncNew = ({ paths }: Deps) =>
  pipe(paths, A.flatMap(findPathMatches))
