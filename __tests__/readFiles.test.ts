import { pipe } from 'fp-ts/function'
import * as E from 'fp-ts/Either'
import {
  doubleStarMatch,
  simplePathMatches,
  splitPath,
  testPatternPresence,
} from '../src/readFiles'
import path from 'path'

describe('Read Files', () => {
  const basePath = path.resolve(__dirname, './mocks')
  const example1Path = path.resolve(__dirname, './mocks/example1.txt')
  let splittedWithDoubleStar = ['']

  it('Split path', () => {
    const splitted = splitPath(basePath)
    expect(splitted[splitted.length - 1]).toBe('mocks')

    splittedWithDoubleStar = splitPath(path.join(basePath, '**'))
    expect(splittedWithDoubleStar[splittedWithDoubleStar.length - 2]).toBe(
      'mocks'
    )
    expect(splittedWithDoubleStar[splittedWithDoubleStar.length - 1]).toBe('**')
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

  it('All sub files', () => {
    const indexOfPattern = splittedWithDoubleStar.findIndex(testPatternPresence)

    expect(indexOfPattern).toBe(splittedWithDoubleStar.length - 1)
    expect(splittedWithDoubleStar[indexOfPattern]).toBe('**')

    const matchedFiles = doubleStarMatch(splittedWithDoubleStar, indexOfPattern)
    expect(matchedFiles._tag).toBe('Right')

    pipe(
      matchedFiles,
      E.map((paths) => {
        expect(paths).toContain(example1Path)
      })
    )
  })
})
