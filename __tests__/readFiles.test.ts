import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import { readFilesSync } from "../src/readFiles";

describe("Read Files", () => {
  it("Sync", () => {

    const res = readFilesSync('./mocks/*');
    
    expect(res).toBe({
      _tag: "Right"
    });

    pipe(
      res,
      E.map(r => {
        expect(r[0].name).toBe('example1.txt');
        expect(r[0].content).toBe('Simple text');
      }),
      E.mapLeft(e => {
        expect(e.message).toBe('');
        expect(e.stack).toBe('');
      })
    )
  });
});