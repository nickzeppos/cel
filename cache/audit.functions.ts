import { BillType } from './types'
import { parseJSONSafe, readFileSyncSafe, withRootCachePath } from './utils'

function makeFilePath(
  congress: number,
  billType?: BillType,
  billNumber?: number,
) {
  // if billType and billNumber are undefined, return congress path
  if (billType === undefined) {
    return `${congress}`
  }
  // if billNumber is undefined, return billType path
  if (billNumber === undefined) {
    return `${congress}/${billType}`
  }
  // else return bill path
  return `${congress}/${billType}/${billNumber}`
}

const makeFilePathWithRoot = withRootCachePath(makeFilePath)

function validateBillFile(content: string, key: string): boolean {
  const { data, error } = parseJSONSafe(content)
  if (error || !data) return false
  return data[key] !== undefined
}

function auditFile(
  path: string,
  key: string,
  validator: (content: string, key: string) => boolean,
) {
  const content = readFileSyncSafe(path)
  return content ? validator(content, key) : false
}

export function auditBill(
  congress: number,
  billType: BillType,
  billNumber: number,
): { bill: boolean; committees: boolean; actions: boolean } {
  const basePath = makeFilePathWithRoot(congress, billType, billNumber)
  return {
    bill: auditFile(`${basePath}/bill.json`, 'bill', validateBillFile),
    committees: auditFile(
      `${basePath}/committees.json`,
      'committees',
      validateBillFile,
    ),
    actions: auditFile(`${basePath}/actions.json`, 'actions', validateBillFile),
  }
}

export function auditBillType(
  congress: number,
  billType: BillType,
  billCount: number,
) {
  const basePath = makeFilePathWithRoot(congress, billType)
  for (let i = 1; i <= billCount; i++) {
    auditBill(congress, billType, i)
  }
}

export function auditCongress(congress: number) {
  const basePath = makeFilePathWithRoot(congress)
  const billTypes: Array<BillType> = ['hr', 's']
  for (const billType of billTypes) {
    const count = 1
    auditBillType(congress, billType as BillType, count)
  }
}
