import { trpc } from '../utils/trpc'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

interface Props {}

export default function MembersCountAssetCard({}: Props) {
  const [assetMetadata, setAssetMetadata] = useState<{
    fileExists: boolean
  }>({
    fileExists: false,
  })
  const assetMetadataQuery = trpc.useQuery([
    'asset-playground.get-membersCount-asset-metadata',
  ])
  useEffect(() => {
    if (assetMetadataQuery.status === 'success') {
      setAssetMetadata({
        fileExists: assetMetadataQuery.data?.fileExists ?? false,
      })
    }
  }, [assetMetadataQuery.status, assetMetadataQuery.data?.fileExists])
  trpc.useSubscription(['asset-playground.membersCount-asset-progress'], {
    onNext: (data) => {
      console.log('membersCount asset progress subscription event')
      console.log(`[membersCount] subscription event. status: ${data.status}`)
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
      <div className="text-sm text-neutral-500">Members count file</div>
    </div>
  )
}
