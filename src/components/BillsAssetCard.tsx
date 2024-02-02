import { trpc } from '../utils/trpc'
import { Chamber } from '@prisma/client'
import { useEffect, useMemo, useState } from 'react'

interface Props {
  chamber: Chamber
  congress: number
}

export default function BillsAssetCard({ chamber, congress }: Props) {
  // state
  const [assetMetadata, setAssetMetadata] = useState<{
    progressStatus: string | undefined
    missingBillNumbers: number[] | undefined
    fullCount: number | undefined
  }>({
    progressStatus: undefined,
    missingBillNumbers: undefined,
    fullCount: undefined,
  })

  // initial state query
  const assetMetadataQuery = trpc.useQuery([
    'asset-playground.get-bills-asset-metadata',
    { chamber, congress },
  ])

  // update state on query success
  useEffect(() => {
    if (assetMetadataQuery.status === 'success') {
      setAssetMetadata({
        progressStatus: undefined,
        missingBillNumbers: assetMetadataQuery.data?.missingBillNumbers,
        fullCount: assetMetadataQuery.data?.fullCount,
      })
    }
  }, [
    assetMetadataQuery.status,
    assetMetadataQuery.data?.missingBillNumbers,
    assetMetadataQuery.data?.fullCount,
  ])

  // set up subscription to update state
  trpc.useSubscription(['asset-playground.congress-api-asset-queue-progress'], {
    onNext: (data) => {
      console.log('cdg api asset queue progress')
      if (
        typeof data !== 'object' ||
        data == null ||
        !('status' in data) ||
        !('type' in data) ||
        !('billNumber' in data)
      ) {
        console.warn('unknown subscription event', data)
        return
      }
      if (typeof data.status !== 'string') {
        console.warn('unknown subscription event', data)
        return
      }
      if (data.type !== 'bills') {
        return
      }
      switch (data.status) {
        case 'FETCHING': {
        }
      }
    },
  })

  const fullCount = 9403
  const MAX_WIDTH = 360
  const BUCKET_WIDTH = 4
  const BUCKET_GAP = 1
  const BUCKET_COUNT = Math.floor(
    (MAX_WIDTH + BUCKET_GAP) / (BUCKET_WIDTH + BUCKET_GAP),
  )

  const BUCKET_SIZE = Math.ceil(fullCount / BUCKET_COUNT)

  const buckets = useMemo(() => {
    return new Array(BUCKET_COUNT).fill(0).map((_, i, a) => {
      const bucketSize =
        i === a.length - 1 ? fullCount % BUCKET_COUNT : BUCKET_SIZE
      const processedCount = Math.floor(Math.random() * bucketSize)
      const successCount = Math.floor(Math.random() * processedCount)
      return {
        bucketSize,
        processedCount,
        successCount,
      }
    })
  }, [])
  return (
    <div className="flex flex-col items-start w-full h-full gap-1 relative">
      <div className="flex flex-[2] items-end gap-2">
        <div className="text-4xl text-neutral-200">0 of {fullCount}</div>
        <div className="text-sm text-neutral-500">bills</div>
      </div>
      <div className={`flex flex-1 w-full`} style={{ gap: BUCKET_GAP }}>
        {buckets.map((props, i) => (
          <BillBucketStatus key={i} {...props} />
        ))}
      </div>
    </div>
  )
}

interface BucketProps {
  bucketSize: number
  processedCount: number
  successCount: number
}
function BillBucketStatus({
  bucketSize,
  processedCount,
  successCount,
}: BucketProps) {
  const L = lightnessScale(processedCount / bucketSize)
  const C = chromaScale(processedCount / bucketSize)
  const H = processedCount > 0 ? hueScale(successCount / processedCount) : 0
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

function BucketWithHeight(props: BucketProps) {
  return <div>bucket 2. only hue varies. height of bar varies.</div>
}
