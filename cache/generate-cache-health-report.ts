/**
 * Script for generating a report of health report for the bill cache.
 *
 * Three criteria for health:
 * For committees, bills, and actions files, we check:
 *  1. Existence. That is, every file we believe should exist does exist.
 *  2. Validity. Is every file valid JSON?
 *  3. Content. Does the file have the expected content? Ensure it's not something like an error code bundled up in JSON. Practically, check if each file contains a first level property corresponding to that file type (i.e., file["actions"] exists]).
 * For actions files, we also check:
 *  4. Length. Does the actions file has the expected amount (the count specified by the accompanying pagination object).
 *
 * Sections of the report:
 *  1. Header. Date of run, script name, current or full audit.
 *  2. Overall score. Healthy/unhealthy, ratio of unhealthy to total files. Additional congress-level breakdowns.
 *  3. Failures. For each audit fail, log identying information for later fetching.
 */
// IMPORTS
import { BillType, CacheConfig } from './types'
import { listDirsInCache, preReportRun } from './utils'
import { existsSync, readFileSync, writeFileSync } from 'fs'

// ENV + CONSTS
const ROOT_CACHE_PATH = process.env.CACHE_PATH || './data/bill/'
const CACHE_HEALTH_REPORT_PATH =
  process.env.CACHE_HEALTH_REPORT_PATH || './cache-health-reports/'
const CACHE_CONFIG_PATH =
  process.env.CACHE_CONFIG_PATH || './data/cache-config.json'

// TYPES
type BillFileType = 'bill' | 'actions' | 'committees'
type BillFailures = {
  billNumber: number
  billType: BillType
  fileType: BillFileType
}
type CongressHealthReport = {
  congress: number
  healthy: boolean
  ratio: number
  failures: Array<BillFailures>
}
type CacheHealthReport = {
  header: {
    runDate: Date
    script: string
    type: 'full' | 'current'
  }
  overallHealth: {
    healthy: boolean
    ratio: number
  }
  healthByCongress: Array<CongressHealthReport>
}

// auditors
function auditBillFile(
  congress: number,
  billType: BillType,
  billNumber: number,
): boolean {
  const path = `${ROOT_CACHE_PATH}/${congress}/${billType}/${billNumber}.json`
  // existence
  if (!existsSync(path)) {
    return false
  }
  let json
  // validity
  try {
    const f = readFileSync(path, 'utf-8')
    json = JSON.parse(f)
  } catch (e) {
    if (e instanceof SyntaxError) {
      return false
    }
  }

  // content
  if (json['bill'] === undefined) {
    return false
  }

  return true
}

function auditCommitteesFile(
  congress: number,
  billType: BillType,
  billNumber: number,
): boolean {
  const path = `${ROOT_CACHE_PATH}/${congress}/${billType}/${billNumber}/committees.json`
  // existence
  if (!existsSync(path)) {
    return false
  }

  // validity
  let json
  try {
    const f = readFileSync(path, 'utf-8')
    json = JSON.parse(f)
  } catch (e) {
    if (e instanceof SyntaxError) {
      return false
    }
  }

  // content
  if (json['committees'] === undefined) {
    return false
  }

  return true
}

function auditActionsFile(
  congress: number,
  billType: BillType,
  billNumber: number,
) {
  const path = `${ROOT_CACHE_PATH}/${congress}/${billType}/${billNumber}/actions.json`
  // existence
  if (!existsSync(path)) {
    return false
  }

  let json
  // validity
  try {
    const f = readFileSync(path, 'utf-8')
    json = JSON.parse(f)
  } catch (e) {
    if (e instanceof SyntaxError) {
      return false
    }
  }

  // content
  if (json['actions'] === undefined) {
    return false
  }

  // length
  const count = json['pagination']['count']
  const actions = json['actions']
  if (count !== actions.length) {
    return false
  }
  return true
}

function auditCongress(
  congress: number,
  config: CacheConfig,
): CongressHealthReport {
  const { billType, count } = config.bills.find((b) => b.congress === congress)!
  const failures: Array<BillFailures> = []
  for (let i = 1; i <= count; i++) {
    const billFileAudit = auditBillFile(congress, billType, i)
    const actionsFileAudit = auditActionsFile(congress, billType, i)
    const committeesFileAudit = auditCommitteesFile(congress, billType, i)
    if (billFileAudit === false) {
      failures.push({
        billNumber: i,
        billType: billType,
        fileType: 'bill',
      })
    }
    if (actionsFileAudit === false) {
      failures.push({
        billNumber: i,
        billType: billType,
        fileType: 'actions',
      })
    }
    if (committeesFileAudit === false) {
      failures.push({
        billNumber: i,
        billType: billType,
        fileType: 'committees',
      })
    }
  }
  const congressRatio = failures.length / count
  const congressHealthy = congressRatio === 0
  return {
    congress: congress,
    healthy: congressHealthy,
    ratio: congressRatio,
    failures: failures,
  }
}

function auditCurrentCache(cache: CacheConfig): void {
  const cacheHealthReport: CacheHealthReport = {
    header: {
      runDate: new Date(),
      script: 'generate-cache-health-report.ts',
      type: 'current',
    },
    overallHealth: {
      healthy: false,
      ratio: 0,
    },
    healthByCongress: [],
  }
  const congresses = listDirsInCache()
  for (const congress of congresses) {
    console.log(`Auditing congress ${congress}`)
    const congressNumber = parseInt(congress)
    const congressHealthReport = auditCongress(congressNumber, cache)
    cacheHealthReport.healthByCongress.push(congressHealthReport)
  }
  // overall health
  const overallFailures = cacheHealthReport.healthByCongress.filter(
    (c) => c.healthy === false,
  )
  const overallRatio =
    overallFailures.length / cacheHealthReport.healthByCongress.length
  const overallHealthy = overallRatio === 0
  cacheHealthReport.overallHealth = {
    healthy: overallHealthy,
    ratio: overallRatio,
  }
  // write report
  const reportName = `current-cache-health-report-${Date.now()}.json`
  const reportPath = `${CACHE_HEALTH_REPORT_PATH}/${reportName}`
  const reportString = JSON.stringify(cacheHealthReport, null, 2)
  writeFileSync(reportPath, reportString)
}

function auditFullCache(config: CacheConfig): void {
  const cacheHealthReport: CacheHealthReport = {
    header: {
      runDate: new Date(),
      script: 'generate-cache-health-report.ts',
      type: 'full',
    },
    overallHealth: {
      healthy: false,
      ratio: 0,
    },
    healthByCongress: [],
  }
  const congresses = config.bills.map((b) => b.congress)
  for (const congressNumber of congresses) {
    console.log(`Auditing congress ${congressNumber}`)
    const congressHealthReport = auditCongress(congressNumber, config)
    cacheHealthReport.healthByCongress.push(congressHealthReport)
  }
  // overall health
  const overallFailures = cacheHealthReport.healthByCongress.filter(
    (c) => c.healthy === false,
  )
  const overallRatio =
    overallFailures.length / cacheHealthReport.healthByCongress.length
  const overallHealthy = overallRatio === 0
  cacheHealthReport.overallHealth = {
    healthy: overallHealthy,
    ratio: overallRatio,
  }
  // write report
  const reportName = `full-cache-health-report-${Date.now()}.json`
  const reportPath = `${CACHE_HEALTH_REPORT_PATH}/${reportName}`
  const reportString = JSON.stringify(cacheHealthReport, null, 2)
  writeFileSync(reportPath, reportString)
}
// MAIN

const auditType = process.argv[2] || 'current' // default current

function main() {
  console.log('-- MAIN')
  // If we don't have a cache directory
  const status = preReportRun()
  if (status === 400) {
    process.exit(1)
    // TODO - - - Logging
    // TODO - - - Add a flag to force create cache config
  }

  // TODO - - - validate to avoid casting
  const config = JSON.parse(
    readFileSync(CACHE_CONFIG_PATH, 'utf8'),
  ) as CacheConfig

  // audit
  if (auditType === 'current') {
    auditCurrentCache(config)
  } else if (auditType === 'full') {
    auditFullCache(config)
  }

  // write the report
  // const reportName = `cache-health-report-${Date.now()}.json`
  // const reportPath = `${CACHE_HEALTH_REPORT_PATH}/${reportName}`
  // const reportString = JSON.stringify(healthReport, null, 2)
  // writeFileSync(reportPath, reportString)
}

main()

export {}
