// Running this script will audit the cache of bills on the ec2 instance.
// Steps:
// 1. Based on $NODE_ENV, decide whether to SSH into EC2 (ssh if development). Note that non-ssh path is currently unimplemented.
// 2. Audit the cache. Auditing currently happens as follows:
//    2.1. With the $SSH_PATH, establish ssh connection and stfp client
//    2.2. Read the cache config file to get some instructions for the audit
//    2.3. For each congress, billType, and billNumber specified by the config, audit the corresponding files.
//      2.3.1. Done primarily with three functions: STFPFn.auditDetailsFile(), STFPFN.auditCommitteesFile() and STFPFN.auditActionsFile()
//      2.3.2. If the directory for the congress and billType does not exist, mark all bills as failed.
//      2.3.3  NOTE: Processing between congresses and within each bill is done concurrently, unbatched. Processing within each congress, for each bill is done concurrently, batched.
//      2.3.4. NOTE: BATCH_SIZE configurable; batch size of 100 exceeds allowable memory usage on ec2.
//    2.4. Write the results to a file in the cache directory, report of type CacheHealthReport. We're currently only writing bills that fail the audit to the health report, as the property billAuditFails suggests.
// imports
import { makeRange } from '../src/assets/utils'
import { BillType, CacheConfig, cacheConfigValidator } from './types'
import { STFPFn, makeAPIUrl } from './utils'
import dotenv from 'dotenv'
import { writeFileSync } from 'fs'
import SSH2Promise from 'ssh2-promise'
import SFTP from 'ssh2-promise/lib/sftp'
import { z } from 'zod'

// env + consts
dotenv.config()
const NODE_ENV = z.string().parse(process.env.NODE_ENV)
// const API_KEYS = z
//   .array(z.string())
//   .parse(process.env.CONGRESS_GOV_API_KEYS?.split(','))
const EC2_HOST_NAME = z.string().parse(process.env.EC2_HOST_NAME)
const EC2_USER_NAME = z.string().parse(process.env.EC2_USER_NAME)
const SSH_KEY_PATH = z.string().parse(process.env.SSH_KEY_PATH)

const BASE_CACHE_PATH = `/home/${EC2_USER_NAME}/bill-jsons/data`
// TODO: Eventually will pivot on this, but unimplemented for now.
// If you're not in dev, you're not allowed to run this script.
if (NODE_ENV !== 'development') {
  process.exit(1)
}

// ssh setup
const config = {
  host: EC2_HOST_NAME,
  username: EC2_USER_NAME,
  identity: SSH_KEY_PATH,
}

const ssh = new SSH2Promise(config)
const sftp = new SSH2Promise.SFTP(ssh)

export type BillAudit = {
  billNumber: number
  details: boolean
  committees: boolean
  actions: boolean
}
export type CongressHealthReport = {
  congress: number
  billType: BillType
  billAuditFails: Array<BillAudit | 'ALL_FAIL'>
  runTime: number
}

type CacheHealthReport = {
  header: {
    runDate: Date
    environment: 'development' | 'production' | 'test'
    name: string
    description: string
    runTime: number
  }
  congresses: Array<CongressHealthReport>
}
const reportName = 'BATCHING_10'
const cacheHealthReport: CacheHealthReport = {
  header: {
    runDate: new Date(),
    environment: NODE_ENV,
    name: reportName,
    description:
      'Working on improving things at the bill level. Batching by 10',
    runTime: 0,
  },
  congresses: [],
}

function sample<T>(arr: Array<T>, n: number): Array<T> {
  const res = []
  for (let i = 0; i < n; i++) {
    res.push(arr.splice(Math.floor(Math.random() * arr.length), 1)[0])
  }
  return res
}

type AuditFunction = (filePath: string, c: SFTP) => Promise<boolean>
type BillKey = [number, BillType, number] // congress number, bill type, bill number
type AuditKey = [string, AuditFunction, string] // cache path, audit fn, endpoint

ssh
  // connect to ec2
  .connect()
  .then(async () => {
    const configPath = `${BASE_CACHE_PATH}/cache-config.json`
    const config = JSON.parse(await sftp.readFile(configPath, 'utf8'))
    return cacheConfigValidator.parse(config)
  })
  .then(async (cacheConfig: CacheConfig) => {
    const firstTuples: BillKey[] = cacheConfig.bills.flatMap(
      ({ congress, billType, count }) =>
        Array.from(
          { length: count },
          (_, i): BillKey => [congress, billType, i + 1],
        ),
    )

    // console.log(firstTuples.length) -> 278054

    const secondTuples: AuditKey[] = firstTuples.flatMap(
      ([congress, billType, billNumber]) => {
        // 3 file paths, one for each file type
        const detailsPath = `${BASE_CACHE_PATH}/bill/data/${congress}/${billType}/${billNumber}.json`
        const committeesPath = `${BASE_CACHE_PATH}/bill/data/${congress}/${billType}/${billNumber}/committees.json`
        const actionsPath = `${BASE_CACHE_PATH}/bill/data/${congress}/${billType}/${billNumber}/actions.json`

        // 3 urls, one for each file type
        const detailsUrl = makeAPIUrl(congress, billType, billNumber, 'details')
        const committeesUrl = makeAPIUrl(
          congress,
          billType,
          billNumber,
          'committees',
        )
        const actionsUrl = makeAPIUrl(congress, billType, billNumber, 'actions')
        const details: AuditKey = [
          detailsPath,
          STFPFn.auditDetailsFile,
          detailsUrl,
        ]
        const committees: AuditKey = [
          committeesPath,
          STFPFn.auditCommitteesFile,
          committeesUrl,
        ]
        const actions: AuditKey = [
          actionsPath,
          STFPFn.auditActionsFile,
          actionsUrl,
        ]
        return [details, committees, actions]
      },
    )

    // console.log(secondTuples.length) -> 834162

    type AsyncMap<AuditKey> = (
      auditKeys: AuditKey[],
      concurrency: number,
    ) => Promise<AuditKey[]>

    async function asyncMap(
      auditKeys: Array<AuditKey>,
      concurrency: number,
    ): Promise<Array<AuditKey>> {
      const queue: Array<Promise<void>> = []
      const results: Array<AuditKey> = []

      async function process(auditKey: AuditKey, index: number): Promise<void> {
        const [path, auditFn, url] = auditKey
        try {
          const auditPassed = await auditFn(path, sftp)
          // we only keep failures!
          if (!auditPassed) {
            results.push(auditKey)
          }
        } catch (error: any) {
          console.error(`Error processing ${index}: ${error.message}`)
        }
      }
      for (let i = 0; i < auditKeys.length; i++) {
        if (queue.length < concurrency) {
          queue.push(process(auditKeys[i], i))
        } else {
          const latestResolvedIndex = await Promise.race(
            queue.map((p, index) => p.then(() => index)),
          )
          queue.splice(latestResolvedIndex, 1)
          queue.push(process(auditKeys[i], i))
        }
      }
      await Promise.all(queue)
      return results
    }

    const SLICE_SLICE = 25000
    const QUEUE_SIZE = 350
    const slicedTuples = secondTuples.slice(0, SLICE_SLICE)
    const start = Date.now()
    console.log(
      `processing sliceSize: ${SLICE_SLICE} concurrency: ${QUEUE_SIZE}`,
    )
    const thirdTuples = await asyncMap(slicedTuples, QUEUE_SIZE)
    const runTime = (Date.now() - start) / 1000
    console.log(`Run time: ${runTime}`)

    //   const congressAuditPromises: Array<Promise<CongressHealthReport>> = []
    //   const start = Date.now()
    //   for (const { congress, billType, count } of cacheConfig.bills) {
    //     // Make path to chamber
    //     const chamberPath = `${BASE_CACHE_PATH}/bill/${congress}/${billType}`

    //     // Ensure dir for congress and billType exists
    //     let dirExists = true
    //     try {
    //       dirExists = await STFPFn.directoryExists(sftp, chamberPath)
    //     } catch (e) {
    //       console.error(`Error checking for directory ${chamberPath}`)
    //       console.error(e)
    //     }
    //     if (dirExists === false) {
    //       // dir doesn't exist, all fail
    //       console.log(`Directory ${chamberPath} does not exist`)

    //       // would push all bills as fail, but just do something simple for now
    //       const congressHealthReport: CongressHealthReport = {
    //         congress,
    //         billType,
    //         billAuditFails: ['ALL_FAIL'],
    //         runTime: 0,
    //       }
    //       cacheHealthReport.congresses.push(congressHealthReport)

    //       continue
    //     }

    //     // if dir does exist, make bill range
    //     const billRange = makeRange(1, count)

    //     // Add congress audit promise to array
    //     congressAuditPromises.push(
    //       STFPFn.auditCongress(
    //         billRange,
    //         congress,
    //         billType,
    //         BASE_CACHE_PATH,
    //         sftp,
    //       ),
    //     )
    //   }

    //   // Wait for all promises to resolve
    //   const congressAudits = await Promise.all(congressAuditPromises)

    //   // Process the results
    //   for (const congressAudit of congressAudits) {
    //     console.log(
    //       `Processsing audit for ${congressAudit.congress} ${congressAudit.billType}`,
    //     )
    //     const { congress, billType, billAuditFails, runTime } = congressAudit
    //     const congressHealthReport: CongressHealthReport = {
    //       congress,
    //       billType,
    //       billAuditFails,
    //       runTime,
    //     }
    //     cacheHealthReport.congresses.push(congressHealthReport)
    //   }

    //   cacheHealthReport.header.runTime = (Date.now() - start) / 1000

    //   return cacheHealthReport
    // })
    // .then((cacheHealthReport: CacheHealthReport) => {
    //   writeFileSync(
    //     `./cache/health-report-${reportName}.json`,
    //     JSON.stringify(cacheHealthReport, null, 2),
    //   )
  })
  .finally(() => ssh.close())
