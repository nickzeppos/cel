import { AllMember } from '../workers/validators'

// utils
export function servedIncludes1973(served: AllMember['served']): boolean {
  if (served.Senate) {
    if (
      served.Senate.some(
        (term) => term.start <= 1973 && (term.end == null || term.end >= 1973),
      )
    ) {
      return true
    }
  }
  if (served.House) {
    if (
      served.House.some(
        (term) => term.start <= 1973 && (term.end == null || term.end >= 1973),
      )
    ) {
      return true
    }
  }
  return false
}
