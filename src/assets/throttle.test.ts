import { sleep } from '../utils/fp'
import { throttle } from '../workers/congressAPI'

describe('throttle', () => {
  it('should call normally once', async () => {
    function* fDurations(): Generator<number, number, void> {
      yield 1000
      return 0
    }

    const f = async (x: number) => {
      await sleep(fDurations().next().value)
      return x * 2
    }

    const g = throttle(f)

    const t0 = Date.now()
    const x = await g(1)
    const t1 = Date.now()
    expect(x).toBe(2)
    console.log(`${t1} - ${t0} = ${t1 - t0}`)
  })

  it('should call a second time before the throttle timeout', (done) => {
    function* fDurations(): Generator<number, number, void> {
      yield 1000
      yield 1000
      return 0
    }

    const f = async (x: number) => {
      await sleep(fDurations().next().value)
      return x * 2
    }

    const g = throttle(f)
    ;(async () => {
      const t0 = Date.now()
      g(1)!.then((x) => {
        // expt(x).toBe(2)
        console.log(`f(1) = ${x}`)
        const t1 = Date.now()
        console.log(`t1 - t0 = ${t1} - ${t0} = ${t1 - t0}`)
      })
      await sleep(500)
      const t2 = Date.now()
      console.log(`t2 - t0 = ${t2} - ${t0} = ${t2 - t0}`)
      g(5)!.then((y) => {
        console.log(`f(5) = ${y}`)
        // expect(y).toBe(10)
        const t3 = Date.now()
        console.log(`t3 - t2 = (${t3} - ${t2} = ${t3 - t2}`)
        done()
      })
    })()
  })
})
