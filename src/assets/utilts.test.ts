import { CONGRESS_API_PAGE_SIZE_LIMIT } from '../../assetDefinitions'
import { AllMember } from '../workers/validators'
import {
  isValidJSON,
  makeRange,
  pageNumberToOffset,
  safeParseJSON, // servedIncludes1973,
  withRootCachePath,
} from './utils'

// describe('servedIncludes1973', () => {
//   const served: AllMember['served'] = {
//     House: [
//       {
//         end: 1972,
//         start: 1968,
//       },
//     ],
//   }

//   it('should return false if start and end are before 1973', () => {
//     expect(servedIncludes1973(served)).toBe(false)
//   })
//   it('should return true if start is before 1973 but end is not', () => {
//     served.House![0]!.end! = 1974
//     expect(servedIncludes1973(served)).toBe(true)
//   })
//   it('should return true start and end both on or after 1973', () => {
//     served.House![0]!.start! = 1973
//     expect(servedIncludes1973(served)).toBe(true)
//   })
//   it('should behave similarly for Senate', () => {
//     delete served.House
//     served.Senate = [
//       {
//         end: 1972,
//         start: 1968,
//       },
//     ]
//     expect(servedIncludes1973(served)).toBe(false)
//     served.Senate![0]!.end! = 1974
//     expect(servedIncludes1973(served)).toBe(true)
//     served.Senate![0]!.start! = 1973
//     expect(servedIncludes1973(served)).toBe(true)
//   })
//   it('should work if one of the chambers includes 1973 but the other doesnt', () => {
//     served.House = [
//       {
//         end: 1972,
//         start: 1968,
//       },
//     ]
//     expect(servedIncludes1973(served)).toBe(true)
//   })
// })

describe('withRootCachePath', () => {
  it('should return a function that prepends the root cache path to the first argument', () => {
    // Test written without actually importing ROOT_CACHE_PATH, so this would fail if
    // value of ROOT_CACHE_PATH deviates from ./data to something new
    const makeFilePath = (a: string, b: string, c: string) => `${a}/${b}/${c}`
    const makeFilePathWithRootCachePath = withRootCachePath(makeFilePath)
    const fileName = makeFilePathWithRootCachePath('a', 'b', 'c')
    expect(fileName).toBe('./data/a/b/c')
  })
})

describe('safeParseJSON', () => {
  it('should return the parsed JSON and null error if the input is valid JSON', () => {
    const validJSON = '{"a": "b"}'
    const { data, error } = safeParseJSON(validJSON)
    expect(error).toBeNull()
    expect(data).toEqual({ a: 'b' })
  })
  it('should return null data and syntax error if the input is not valid JSON', () => {
    const invalidJSON = 'a'
    const { data, error } = safeParseJSON(invalidJSON)
    expect(error).toBeInstanceOf(SyntaxError)
    expect(data).toBeNull()
  })
})

describe('isValidJSON', () => {
  it('should return true if the input is valid JSON', () => {
    const validJSON = '{"a": "b"}'
    expect(isValidJSON(validJSON)).toBe(true)
  })
  it('should return false if the input is not valid JSON', () => {
    const invalidJSON = 'a'
    expect(isValidJSON(invalidJSON)).toBe(false)
  })
})

describe('makeRange', () => {
  it('should return an array of integers from first to last, inclusive', () => {
    expect(makeRange(1, 3)).toEqual([1, 2, 3])
  })
  it('should return empty array if first is greater than last', () => {
    expect(makeRange(3, 1)).toEqual([])
  })
})

describe('pageNumberToOffset', () => {
  it('should return the correct offset for a given page number and limit', () => {
    expect(pageNumberToOffset(1, 20)).toBe(0)
    expect(pageNumberToOffset(2, 20)).toBe(20)
  })
  it('should work with our constant page size limit', () => {
    const limit = CONGRESS_API_PAGE_SIZE_LIMIT
    expect(pageNumberToOffset(1, limit)).toBe(0)
    expect(pageNumberToOffset(2, limit)).toBe(limit)
  })
})
