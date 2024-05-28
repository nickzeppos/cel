import { trpc } from '../utils/trpc'
import { Chamber } from '@prisma/client'
import clsx from 'clsx'

interface Props {
  chamber: Chamber
  congress: number
}

export default function ImportantListAssetCard({ chamber, congress }: Props) {
  const assetMetadataQuery = trpc.useQuery([
    'asset-playground.get-importantList-asset-metadata',
    { chamber, congress },
  ])

  trpc.useSubscription(['asset-playground.on-change'], {
    onNext: (data) => {
      if (data.assetName !== 'importantList') return
      assetMetadataQuery.refetch()
    },
  })

  if (assetMetadataQuery === undefined) {
    return (
      <div className="flex flex-col items-start w-full h-full gap-1 relative">
        <div className="flex flex-[2] items-end gap-2">
          <div className="text-4xl text-neutral-200"></div>
          <div className="text-sm text-neutral-500">Waiting on metadata...</div>
        </div>
      </div>
    )
  } else if (assetMetadataQuery.data === null) {
    return (
      <div className="flex flex-col items-start w-full h-full gap-1 relative">
        <div className="flex flex-[2] items-end gap-2">
          <div className="text-4xl text-neutral-200"></div>
          <div className="text-sm text-neutral-500">No metadata found</div>
        </div>
      </div>
    )
  } else {
    ;<div className="flex flex-col items-center w-full">
      <div
        className={clsx(
          assetMetadataQuery.data?.fileExists
            ? 'text-green-500'
            : 'text-red-500',
          'text-4xl text-neutral-200',
        )}
      >
        {assetMetadataQuery.data?.fileExists ? '✅' : '❌'}
      </div>
      <div className="text-sm text-neutral-500">
        Important Bills List for {congress} {chamber}
      </div>
    </div>
  }
}
