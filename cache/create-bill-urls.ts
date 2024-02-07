import { appendFileSync, closeSync, openSync, readdirSync } from 'fs'

const files = readdirSync('./data/bills').filter((file) =>
  file.match(/page-\d+\.json/),
)

let n = 0

type Data = {
  bills: Array<{ number: string }>
}

const billTypes = {
  HOUSE: 'hr',
  SENATE: 's',
}

let fd: undefined | number = undefined
try {
  fd = openSync('bill-urls.txt', 'a')
  files.forEach((file) => {
    const data = require(`../data/bills/${file}`) as Data
    const [congress, chamber, _page, pageNumber] = file
      .replace('.json', '')
      .split('-')
    const billType = billTypes[chamber as 'HOUSE' | 'SENATE']

    data.bills
      .map(({ number }) => number)
      .forEach((billNumber) => {
        if (fd != null) {
          appendFileSync(
            fd,
            `/bill/${congress}/${billType}/${billNumber}\n`,
            'utf8',
          )
          appendFileSync(
            fd,
            `/bill/${congress}/${billType}/${billNumber}/actions\n`,
            'utf8',
          )
          appendFileSync(
            fd,
            `/bill/${congress}/${billType}/${billNumber}/committees\n`,
            'utf8',
          )
        }
      })
  })
} catch (err) {
  console.error(err)
} finally {
  if (fd != null) closeSync(fd)
}

export {}
