// Usage: ts-node scripts/spy-and-log.ts
// Periodically run two bash commands:
// (1) use wc -l to count the lines in the urls file
// (2) use du -sh to get the size of the jsons directory
// Outputs piped into spy.log via run-spy.sh
import { execSync } from 'child_process'

const OUTPUT_LOG_PATH = 'output.log'
const URLS_PATH = 'bill-urls.txt'

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`)
}

function getLineCount(filepath: string): string {
  return execSync(`wc -l ${filepath}`).toString().trim()
}

function getFolderSize(filepath: string): string {
  return execSync(`du -sh ${filepath}`).toString().trim()
}

function getLastLine(filepath: string): string {
  return execSync(`tail -n 1 ${filepath}`).toString().trim()
}

// when consume-bill-urls.ts ends, it writes "done" to the end
// of the output.log file. We'll use that as our while condition
async function main() {
  let stop = getLastLine(OUTPUT_LOG_PATH)

  // stop comes with a timestamp, expected shape is something like
  // [2023-01-01T00:00:00.000Z] done
  // Split on space and take the last element
  stop = stop.split(' ').pop() as string

  while (stop !== 'done') {
    try {
      log(`${getLineCount(URLS_PATH)}`)
      log(`${getFolderSize('./data')}`)
      // sleep 10 seconds
      await sleep(10000)
      stop = getLastLine('output.log')
      stop = stop.split(' ').pop() as string
    } catch (e) {
      console.error(e)
      process.exit(1)
    }
  }
  log('done')
  process.exit(0)
}

main()

export {}
