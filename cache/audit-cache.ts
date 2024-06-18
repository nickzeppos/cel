// Running this script will audit the cache of bills on the ec2 instance.
// Steps:
// 1. Based on $NODE_ENV, decide whether to SSH into EC2 (ssh if development). Note that non-ssh path is currently unimplemented.
// 2. Audit the cache. Auditing currently happens as follows:
//    2.1. With the $SSH_PATH, establish ssh connection and stfp client
//    2.2. Read the cache config file to get some instructions for the audit
//    2.3. For each congress, billType, and billNumber specified by the config, audit the corresponding files.
//    2.4. For each failed audit, write url to .txt. File name is finish date of script.
// 3. Close the ssh connection
//
// Current run time is ~ 7.5m with concurrency = 250, auditKeys.length = 834162
//
// Audit history
// 6-18-2024--10-36-50-AM.txt - 198366 failed audits
//
// imports
import { AuditKey, BillKey, asyncMap1 } from './asyncMap'
import { CacheConfig, cacheConfigValidator } from './types'
import { STFPFn, makeAPIUrl } from './utils'
import dotenv from 'dotenv'
import { createWriteStream } from 'fs'
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

ssh
  // connect to ec2
  .connect()
  .then(async () => {
    console.log('Reading config...')
    const configPath = `${BASE_CACHE_PATH}/cache-config.json`
    const config = JSON.parse(await sftp.readFile(configPath, 'utf8'))
    return cacheConfigValidator.parse(config)
  })
  .then(async (cacheConfig: CacheConfig) => {
    console.log('Parsing config info billKeys...')
    const billKeys: BillKey[] = cacheConfig.bills.flatMap(
      ({ congress, billType, count }) =>
        Array.from(
          { length: count },
          (_, i): BillKey => [congress, billType, i + 1],
        ),
    )

    // console.log(billKeys.length) -- 278054

    console.log('Creating audit keys...')
    const auditKeys: AuditKey[] = billKeys.flatMap(
      ([congress, billType, billNumber]) => {
        // 3 file paths, one for each file type
        const detailsPath = `${BASE_CACHE_PATH}/bill/${congress}/${billType}/${billNumber}.json`
        const committeesPath = `${BASE_CACHE_PATH}/bill/${congress}/${billType}/${billNumber}/committees.json`
        const actionsPath = `${BASE_CACHE_PATH}/bill/${congress}/${billType}/${billNumber}/actions.json`

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

    // console.log(auditKeys.length) -- 834162

    const concurrency = 250
    const failedAuditKeys = await asyncMap1(auditKeys, concurrency, sftp)

    const urls: Array<string> = failedAuditKeys.map(([_path, _, url]) => url)
    const finish = new Date(Date.now())
      .toLocaleString()
      .replace(/\/|,|:| /g, '-')
    const instructionsPath = `./cache/instructions/${finish}.txt`
    const stream = createWriteStream(instructionsPath, 'utf-8')
    for (const url of urls) {
      stream.write(`${url}\n`)
    }
    stream.end()
  })
  .finally(() => {
    console.log('Closing ssh connection...')
    ssh.close()
  })
