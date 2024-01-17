import { AllMember } from '../workers/validators'
import { servedIncludes1973, withRootCachePath } from './utils'

describe('servedIncludes1973', () => {
  const served: AllMember['served'] = {
    House: [
      {
        end: 1972,
        start: 1968,
      },
    ],
  }

  it('should return false if start and end are before 1973', () => {
    expect(servedIncludes1973(served)).toBe(false)
  })
  it('should return true if start is before 1973 but end is not', () => {
    served.House![0]!.end! = 1974
    expect(servedIncludes1973(served)).toBe(true)
  })
  it('should return true start and end both on or after 1973', () => {
    served.House![0]!.start! = 1973
    expect(servedIncludes1973(served)).toBe(true)
  })
  it('should behave similarly for Senate', () => {
    delete served.House
    served.Senate = [
      {
        end: 1972,
        start: 1968,
      },
    ]
    expect(servedIncludes1973(served)).toBe(false)
    served.Senate![0]!.end! = 1974
    expect(servedIncludes1973(served)).toBe(true)
    served.Senate![0]!.start! = 1973
    expect(servedIncludes1973(served)).toBe(true)
  })
  it('should work if one of the chambers includes 1973 but the other doesnt', () => {
    served.House = [
      {
        end: 1972,
        start: 1968,
      },
    ]
    expect(servedIncludes1973(served)).toBe(true)
  })
})

describe('withRootCachePath', () => {
  it('should return a function that prepends the root cache path to the first argument', () => {
    const makeFileName = (a: string, b: string, c: string) => `${a}/${b}/${c}`
    const makeFileNameWithRootCachePath = withRootCachePath(makeFileName)
    const fileName = makeFileNameWithRootCachePath('a', 'b', 'c')
    expect(fileName).toBe('./data/a/b/c')
  })
})
