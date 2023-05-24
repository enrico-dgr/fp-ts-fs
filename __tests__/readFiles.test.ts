import { readFilesSyncNew } from '../src/readFiles'
import path from 'path'

describe('Read Files', () => {
  it('Sync', () => {
    const basePath = path.join(__dirname, './mocks')

    const res = readFilesSyncNew({ paths: [`${basePath}/.*`] })

    expect(res.length).toBe(1)

    expect(res[0].path).toBe(path.join(basePath, 'example1.txt'))
    expect(res[0].content).toBe('Simple text')
  })
})
