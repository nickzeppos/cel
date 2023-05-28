import { Chamber } from "@prisma/client"
import { useMemo } from "react"

interface Props {
  chamber: Chamber
  congress: number
}

const MAX_WIDTH = 360
const BUCKET_WIDTH = 4
const BUCKET_GAP = 1
const BUCKET_COUNT = Math.floor((MAX_WIDTH + BUCKET_GAP) / (BUCKET_WIDTH + BUCKET_GAP))

const COUNT = 9698
const BUCKET_SIZE = Math.ceil(COUNT / BUCKET_COUNT)

export default function BillAssetCard({ chamber, congress }: Props) {
  const buckets = useMemo(() => {
    return new Array(BUCKET_COUNT).fill(0).map((_, i, a) => {
      const bucketSize = i === a.length - 1 ? (COUNT % BUCKET_COUNT) : BUCKET_SIZE
      const processedCount = Math.floor(Math.random() * bucketSize)
      const successCount = Math.floor(Math.random() * processedCount)
      return {
        bucketSize,
        processedCount,
        successCount,
      }
    })
  }, [])
  return <div className="flex flex-col items-start w-full h-full gap-1 relative">
    <div className="flex flex-[2] items-end gap-2">
      <div className="text-4xl text-neutral-200">4000 of {COUNT}</div>
      <div className="text-sm text-neutral-500">bills</div>
    </div>
    <div className={`flex flex-1 w-full`} style={{ gap: BUCKET_GAP }}>
      {buckets.map((props, i) => <BillBucketStatus key={i} {...props} />)}
    </div>
  </div>

}

interface BillBucketStatusProps {
  bucketSize: number
  processedCount: number
  successCount: number
}
function BillBucketStatus({
  bucketSize,
  processedCount,
  successCount,
}: BillBucketStatusProps) {
  const L = '60%'
  const C = (processedCount / bucketSize) * 0.24
  const H = processedCount === 0 ? 0 : hueScale(successCount / (processedCount))
  return <div className={`h-[25px]`}
    style={{
      width: BUCKET_WIDTH,
      backgroundColor: `oklch(${L} ${C} ${H})`
    }}>
  </div>
}

function hueScale(value: number): number {
  // 0 -> 34
  // 1 -> 145.26
  return 34 + (value * 111.26)
}