// read the first line from bill-urls.txt
// try to fetch the url from congress.gov api
// save the data to a folder corresponding to the url
// check the file that was saved
// if the file exists and has size > 0, then delete the first line from bill-urls.txt
import { execSync } from 'child_process'
import dotenv from 'dotenv'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import fetch, { Headers, Request } from 'node-fetch'

dotenv.config()
const API_KEY = process.env.CONGRESS_GOV_API_KEY ?? ''
const API_BASE_URL = process.env.CONGRESS_GOV_API_BASE_URL ?? ''
const URLS_PATH = 'bill-urls.txt'

function getFirstLine(filePath: string): string {
  return execSync(`head -n 1 ${filePath}`).toString().trim()
}

function deleteFirstLine(filePath: string): void {
  execSync(`sed -i '1d' ${filePath}`)
}

function getPathFromUrl(url: string): string {
  const [_, _bill, congress, billType, billNumber, part] = url.split('/')
  return `./data/bill/${congress}/${billType}/${billNumber}${
    part != null ? `/${part}` : ''
  }.json`
}

function ensureDirExists(filepath: string): void {
  const dir = filepath.split('/').slice(0, -1).join('/')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function fetchRoute(route: string): Promise<void> {
  const url = `${API_BASE_URL}${route}`
  return new Promise((resolve, reject) => {
    fetch(
      new Request(url, {
        method: 'get',
        headers: new Headers({
          accept: 'application/json',
          'x-api-key': `${API_KEY}`,
        }),
      }),
    )
      .then((res) => {
        const filepath = getPathFromUrl(route)
        console.log(`writing to ${filepath}`)
        ensureDirExists(filepath)
        res.body.pipe(
          createWriteStream(filepath)
            .on('finish', () => resolve())
            .on('error', (e) => reject(e)),
        )
      })
      .catch((e) => reject(e))
  })
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`)
}

async function main() {
  let route = getFirstLine(URLS_PATH)
  while (route !== '') {
    try {
      log(`fetching ${route}`)
      await fetchRoute(route)
      deleteFirstLine(URLS_PATH)
    } catch (e) {
      log('fetch failed, do not delete the first line')
      console.error(e)
      process.exit(1)
    }
    await sleep(5000)
    route = getFirstLine(URLS_PATH)
  }
  log('done')
  process.exit(0)
}

main()

export {}

// nohup yarn ts-node scripts/consume-bill-urls.ts >> output.log 2>&1 &
// ps aux | grep consume-bill-urls
// kill 12345

// 815250
