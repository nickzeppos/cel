import { trpc } from '../utils/trpc'
import { Chamber } from '.prisma/client'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

interface Props {
  chamber: Chamber
  congress: number
}
export default function BillsCountAssetCard({ chamber, congress }: Props) {
  const [assetMetadata, setAssetMetadata] = useState<{
    fileExists: boolean
  }>({
    fileExists: false,
  })
  const assetMetadataQuery = trpc.useQuery([
    'asset-playground.get-bills-count-asset-metadata',
    { chamber, congress },
  ])

  useEffect(() => {
    if (assetMetadataQuery.status === 'success') {
      setAssetMetadata({
        fileExists: assetMetadataQuery.data?.fileExists ?? false,
      })
    }
  }, [assetMetadataQuery.status, assetMetadataQuery.data?.fileExists])

  trpc.useSubscription(['asset-playground.billsCount-asset-progress'], {
    onNext: (data) => {
      console.log('billsCount asset progress subscription event')

      console.log(`[billsCount] subscription event. status: ${data.status}`)
      switch (data.status) {
        case 'COMPLETE': {
          assetMetadataQuery.refetch()
          break
        }
      }
    },
  })

  return (
    <div className="flex flex-col items-center w-full">
      <div
        className={clsx(
          assetMetadata.fileExists ? 'text-green-500' : 'text-red-500',
          'text-4xl text-neutral-200',
        )}
      >
        {assetMetadata.fileExists ? '✅' : '❌'}
      </div>
      <div className="text-sm text-neutral-500">
        Bill count file for {congress} {chamber}
      </div>
    </div>
  )
}
