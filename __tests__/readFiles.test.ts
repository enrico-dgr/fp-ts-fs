import { pipe } from 'fp-ts/function'
import * as E from 'fp-ts/Either'
import {
  doubleStarMatch,
  readFilesSync,
  regexMatch,
  simplePathMatches,
  splitPath,
  testPatternPresence,
} from '../src/readFiles'
import path from 'path'

describe('Read Files', () => {
  const basePath = path.resolve(__dirname, './mocks')
  const example1Path = path.resolve(__dirname, './mocks/example1.txt')
  const example2Path = path.resolve(__dirname, './mocks/example2.txt')
  let splittedWithDoubleStar = ['']
  let splittedWithRegex = ['']

  it('Split path', () => {
    const splitted = splitPath(basePath)
    expect(splitted[splitted.length - 1]).toBe('mocks')

    splittedWithDoubleStar = splitPath(path.join(basePath, '**'))
    expect(splittedWithDoubleStar[splittedWithDoubleStar.length - 2]).toBe(
      'mocks'
    )
    expect(splittedWithDoubleStar[splittedWithDoubleStar.length - 1]).toBe('**')

    splittedWithRegex = splitPath(path.join(basePath, 'ex.*1.txt'))
    expect(splittedWithRegex[splittedWithRegex.length - 2]).toBe('mocks')
    expect(splittedWithRegex[splittedWithRegex.length - 1]).toBe('ex.*1.txt')
  })

  it('Simple match', () => {
    const example1 = simplePathMatches(example1Path)
    expect(example1._tag).toBe('Right')
    pipe(
      example1,
      E.map(([firstRes]) => {
        expect(firstRes.content).toBe('Simple text')
      })
    )
  })

  it('All files', () => {
    const indexOfPattern = splittedWithDoubleStar.findIndex(testPatternPresence)

    expect(indexOfPattern).toBe(splittedWithDoubleStar.length - 1)
    expect(splittedWithDoubleStar[indexOfPattern]).toBe('**')

    const matchedFiles = doubleStarMatch(splittedWithDoubleStar, indexOfPattern)
    expect(matchedFiles._tag).toBe('Right')

    pipe(
      matchedFiles,
      E.map((paths) => {
        expect(paths).toContain(path.join(__dirname, 'mocks', '.*'))
      })
    )
  })

  it('Filter files', () => {
    const indexOfPattern = splittedWithRegex.findIndex(testPatternPresence)

    expect(indexOfPattern).toBe(splittedWithRegex.length - 1)
    expect(splittedWithRegex[indexOfPattern]).toBe('ex.*1.txt')

    const matchedFiles = regexMatch(splittedWithRegex, indexOfPattern)
    expect(matchedFiles._tag).toBe('Right')

    pipe(
      matchedFiles,
      E.map((paths) => {
        expect(paths.length).toBe(1)
        expect(paths).toContain(example1Path)
      })
    )
  })

  it('Read files sync', () => {
    pipe(
      readFilesSync({
        paths: [path.join(__dirname, '**', 'ex.*1\.txt')],
      }),
      E.map((paths) => {
        expect(paths.length).toBe(1)
        expect(paths[0].path).toBe(example1Path)
        expect(paths[0].content).toBe('Simple text')
      }),
      either => {
        expect(either._tag).toBe('Right')
      }
    )

    pipe(
      readFilesSync({
        paths: [path.join(__dirname, '**', 'ex.*2\.txt')],
      }),
      E.map((paths) => {
        expect(paths.length).toBe(1)
        expect(paths[0].path).toBe(example2Path)
        expect(paths[0].content).toBe('Simple text')
      }),
      either => {
        expect(either._tag).toBe('Right')
      }
    )
  })
})
