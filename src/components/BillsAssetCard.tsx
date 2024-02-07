import { StoredAssetStatus } from '../assets/assets.validators'
import { trpc } from '../utils/trpc'
import { Chamber } from '@prisma/client'
import { useEffect, useMemo, useState } from 'react'

interface Props {
  chamber: Chamber
  congress: number
}

export default function BillsAssetCard({ chamber, congress }: Props) {
  // initial state query
  const assetState = trpc.useQuery([
    'asset-playground.get-bills-asset-metadata',
    { chamber, congress },
  ])
  const [billStatuses, setBillStatuses] = useState<
    Record<string, StoredAssetStatus>
  >({})

  useEffect(() => {
    if (assetState.status == 'success') {
      setBillStatuses(assetState.data?.billStatuses ?? {})
    }
  }, [assetState.data?.billStatuses])

  // set up progress subscription
  trpc.useSubscription(['asset-playground.bills-asset-progress'], {
    onNext: (data) => {
      setBillStatuses(data.billStatuses)
    },
  })
  const passCount = useMemo(() => {
    return Object.values(billStatuses).filter((status) => status === 'PASS')
      .length
  }, [billStatuses])

  // const buckets = useMemo(() => {
  //   return new Array(BUCKET_COUNT).fill(0).map((_, i, a) => {
  //     const bucketSize =
  //       i === a.length - 1 ? fullCount % BUCKET_COUNT : BUCKET_SIZE
  //     const processedCount = Math.floor(Math.random() * bucketSize)
  //     const successCount = Math.floor(Math.random() * processedCount)
  //     return {
  //       bucketSize,
  //       processedCount,
  //       successCount,
  //     }
  //   })
  // }, [])

  const BAR_MAX_WIDTH = 360 // max width of the progress bar
  const BAR_WIDTH = 4 // width of each bar
  const BAR_GAP = 1 // gap between each bar
  const BAR_COUNT = Math.floor(
    (BAR_MAX_WIDTH + BAR_GAP) / (BAR_WIDTH + BAR_GAP),
  ) // total number of bars possible

  // memoizing progress bar objects
  const progressBars = useMemo(() => {
    // calculate the total bill count based on bill statuses state
    const totalBillCount = Object.keys(billStatuses).length

    // calculate the number of bills that should be in each bar
    const barBillCount = Math.ceil(totalBillCount / BAR_COUNT)

    // create a new array of length BAR_COUNT, to be filled with progress bar objects
    return (
      Array(BAR_COUNT)
        .fill(0)
        // for each BAR_COUNT element
        .map((_, i, a) => {
          // first calculate number of bills that will be in the bar.
          // normally, it's the barBillCount determined at the top,
          // but in the case that this is the last bar, it will be set to the remainder
          // to ensure all bills are accounted for
          const numberOfBillsInBar =
            i === a.length - 1 ? totalBillCount % BAR_COUNT : barBillCount

          // calculate start and end indices for bills that will be in this bar
          const start = i * numberOfBillsInBar

          // end is min of start + number of bills in bar, or the total bill count
          const end = Math.min(start + numberOfBillsInBar, totalBillCount)

          // use start and end to index into bill statuses state, to get the bills
          // corresponding to the current bar
          const billStatusesForBar = Object.values(billStatuses).slice(
            start,
            end,
          )

          // calculate counts of bills in each status in the sliced portion
          const passCount = billStatusesForBar.filter(
            (status) => status === 'PASS',
          ).length
          const failCount = billStatusesForBar.filter(
            (status) => status === 'FAIL',
          ).length
          const pendingCount = billStatusesForBar.filter(
            (status) => status === 'PENDING',
          ).length

          return {
            passCount,
            failCount,
            pendingCount,
          }
        })
    )
  }, [billStatuses])

  if (!assetState || !assetState.data) {
    return (
      <div className="flex flex-col items-start w-full h-full gap-1 relative">
        <div className="flex flex-[2] items-end gap-2">
          <div className="text-4xl text-neutral-200"></div>
          <div className="text-sm text-neutral-500">Waiting on metadata...</div>
        </div>
      </div>
    )
  } else {
    return (
      <div className="flex flex-col items-start w-full h-full gap-1 relative">
        <div className="flex flex-[2] items-end gap-2">
          <div className="text-4xl text-neutral-200">
            {passCount} of {Object.keys(billStatuses).length}
          </div>
          <div className="text-sm text-neutral-500">bills</div>
        </div>
        <div className="flex flex-1 w-full" style={{ gap: BAR_GAP }}>
          {progressBars.map((props, i) => (
            <ProgressBarWithStatus key={i} {...props} />
          ))}
        </div>
      </div>
    )
  }
}

interface ProgressBarProps {
  passCount: number
  pendingCount: number
  failCount: number
}
function ProgressBarWithStatus({
  passCount,
  pendingCount,
  failCount,
}: ProgressBarProps) {
  const total = passCount + pendingCount + failCount
  const processedCount = passCount + failCount
  const L = lightnessScale(processedCount / total)
  const C = chromaScale(processedCount / total)
  const H = processedCount > 0 ? hueScale(passCount / processedCount) : 0
  return (
    <div
      className={`h-[25px]`}
      style={{
        width: 4,
        backgroundColor: `oklch(${L} ${C} ${H})`,
      }}
    ></div>
  )
}

// denormalize a number from 0-1

function lightnessScale(value: number): number {
  // 0 -> .3
  // 1 -> .7
  return 0.3 + value * 0.4
}

function hueScale(value: number): number {
  // 0 -> 34
  // 1 -> 145.26
  return 34 + value * 111.26
}

function chromaScale(value: number): number {
  // 0 -> 0
  // 1 -> 0.24
  return value * 0.24
}

function BucketWithHeight(props: ProgressBarProps) {
  return <div>bucket 2. only hue varies. height of bar varies.</div>
}
