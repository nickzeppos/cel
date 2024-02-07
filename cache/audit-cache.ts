// Script for auditing cache
// IMPORTS
import { sysArgsValidator } from './types'

const sysArgs = process.argv.slice(2)
let sysArgsObj = sysArgs.reduce((acc, arg) => {
  const [key, value] = arg.split('=')
  if (key !== undefined) {
    if (key === 'full') {
      return { ...acc, [key]: value === 'true' }
    } else {
      return { ...acc, [key]: value }
    }
  } else {
    return acc
  }
}, {})

// If no arguments are passed, default to full=true
if (Object.keys(sysArgsObj).length === 0) {
  sysArgsObj = { full: true }
}

const SysArgs = sysArgsValidator.parse(sysArgsObj)

// destructure
const { full = false, congress, billType, billNumber } = SysArgs

if (full) {
  // do full audit
} else if (congress) {
  if (billType && billNumber) {
    // do bill audit
  } else if (billType) {
    // do bill type audit
  } else {
    // do congress audit
  }
} else {
  // exit, but validator should have caught this
  process.exit(1)
}
