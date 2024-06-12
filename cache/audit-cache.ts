// Running this script will audit the cache of bills on the ec2 instance.
// Steps:
// 1. Based on $CURRENT_CONGRESS, and if necessary, amend the config file
// 2. Based on $NODE_ENV, decide whether to SSH into EC2 (ssh if development).
// 3. Audit cache and produce health report
//
// If necessary, SSH connection is established as follows:
// 1. $SSH_PATH is mounted into Docker container.
// -- Done in docker-compose.yml ``` volumes: - ${SSH_PATH}:/.ssh ```
// -- We can consider doing this a different way (e.g., more .env vars, Docker secrets), but this is current implementation.
// 2. ssh alias lep-dev, assumed to be in .ssh/config file, is used to connect to ec2 instance
// imports
import { makeRange } from '../src/assets/utils'
import { CacheConfig, cacheConfigValidator } from './types'
import { SSHfs } from './utils'
import dotenv from 'dotenv'
import { writeFileSync } from 'fs'
import SSH2Promise from 'ssh2-promise'
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

type BillAudit = {
  billNumber: number
  details: boolean
  committees: boolean
  actions: boolean
}
type CongressHealthReport = {
  congress: number
  billType: string
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
const reportName = 'BASELINE_AUDIT'
const cacheHealthReport: CacheHealthReport = {
  header: {
    runDate: new Date(),
    environment: NODE_ENV,
    name: reportName,
    description:
      'Brute forced with all read operations conducted individually with SFTP. No paralellization, no streaming, nothing. Just want a baseline',
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

ssh
  // connect to ec2
  .connect()
  .then(async () => {
    const configPath = `${BASE_CACHE_PATH}/cache-config.json`

    // read cache config
    const config = JSON.parse(await sftp.readFile(configPath, 'utf8'))
    return cacheConfigValidator.parse(config)
  })
  .then(async (cacheConfig: CacheConfig) => {
    // SAMPLING WHILE TESTING
    // randomly sample 5 entries from config.bills
    // log length

    const configSample = sample(cacheConfig.bills, 5)

    for (const { congress, billType, count } of configSample) {
      const congressHealthReport: CongressHealthReport = {
        congress,
        billType,
        billAuditFails: [],
        runTime: 0,
      }

      // Make path to chamber
      const chamberPath = `${BASE_CACHE_PATH}/bill/${congress}/${billType}`

      // Ensure dir for congress and billType exists
      if ((await SSHfs.directoryExists(sftp, chamberPath)) === false) {
        // dir doesn't exist, all fail
        console.log(`Directory ${chamberPath} does not exist`)

        // would push all bills as fail, but just do something smiple for now
        congressHealthReport.billAuditFails.push('ALL_FAIL')
        cacheHealthReport.congresses.push(congressHealthReport)

        continue
      }

      // if dir does exist, make bill range
      const billRange = makeRange(1, count)

      // SAMPLING WHILE TESTING
      // randomly sample 5 bills
      const billSample = sample(billRange, 5)

      const startTime = Date.now()

      for (const billNum of billSample) {
        console.log(`Auditing ${congress} ${billType} ${billNum}`)
        const billPath = `${chamberPath}/${billNum}`
        const detailsAudit = await SSHfs.auditDetailsFile(
          `${billPath}.json`,
          sftp,
        )
        const committeesAudit = await SSHfs.auditCommitteesFile(
          `${billPath}/committees.json`,
          sftp,
        )
        const actionsAudit = await SSHfs.auditActionsFile(
          `${billPath}/actions.json`,
          sftp,
        )

        // if all true, then bill is good, we only push fails
        if (detailsAudit && committeesAudit && actionsAudit) {
          console.log(`Bill ${billNum} passed all checks, not pushing`)
          continue
        }

        const billAudit = {
          billNumber: billNum,
          details: detailsAudit,
          committees: committeesAudit,
          actions: actionsAudit,
        }

        congressHealthReport.billAuditFails.push(billAudit)

        console.log(
          `${detailsAudit}, Committees: ${committeesAudit}, Actions: ${actionsAudit}`,
        )
      }

      const runTime = (Date.now() - startTime) / 1000
      congressHealthReport.runTime = runTime
      cacheHealthReport.congresses.push(congressHealthReport)
      cacheHealthReport.header.runTime += runTime
    }
    return cacheHealthReport
  })
  .then((cacheHealthReport: CacheHealthReport) => {
    writeFileSync(
      `./cache/health-report-${reportName}.json`,
      JSON.stringify(cacheHealthReport, null, 2),
    )
  })
  .finally(() => {
    ssh.close()
  })

// audit cache

// produce cache health report

// SYS ARG PARSING, USED TO DETERMINE SCOPE OF AUDIT (I.E., FULL VS. CONGRESS, ETC.)
// import { sysArgsValidator } from './types'

// const sysArgs = process.argv.slice(2)
// let sysArgsObj = sysArgs.reduce((acc, arg) => {
//   const [key, value] = arg.split('=')
//   if (key !== undefined) {
//     if (key === 'full') {
//       return { ...acc, [key]: value === 'true' }
//     } else {
//       return { ...acc, [key]: value }
//     }
//   } else {
//     return acc
//   }
// }, {})

// // If no arguments are passed, default to full=true
// if (Object.keys(sysArgsObj).length === 0) {
//   sysArgsObj = { full: true }
// }

// const SysArgs = sysArgsValidator.parse(sysArgsObj)

// // destructure
// const { full = false, congress, billType, billNumber } = SysArgs

// if (full) {
//   // do full audit
// } else if (congress) {
//   if (billType && billNumber) {
//     // do bill audit
//   } else if (billType) {
//     // do bill type audit
//   } else {
//     // do congress audit
//   }
// } else {
//   // exit, but validator should have caught this
//   process.exit(1)
// }
