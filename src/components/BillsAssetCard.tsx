import { trpc } from '../utils/trpc'
import { Chamber } from '@prisma/client'
import clsx from 'clsx'

interface Props {
  chamber: Chamber
  congress: number
}
export default function BillsAssetCard({ chamber, congress }: Props) {
  const assetState = trpc.useQuery([
    'asset-playground.get-bills-asset-state',
    { chamber, congress },
  ])

  const pageCount = assetState.data?.pageStatuses.length ?? 'unknown'
  const pageStatuses = assetState.data?.pageStatuses ?? []

  return (
    <div className="flex flex-col items-start w-full h-full gap-1">
      <div className="flex flex-[2] items-end gap-2">
        <div className="text-4xl text-neutral-200">{pageCount}</div>
        <div className="text-sm text-neutral-500">pages of bill metadata</div>
      </div>
      <div className="flex flex-1 w-full gap-[2px] ">
        {pageStatuses.map(({ file, status }) => (
          <div key={file} className={clsx('w-full h-full', getColor(status))} />
        ))}
      </div>
    </div>
  )
}

function getColor(status: string) {
  switch (status) {
    case 'complete':
      return 'bg-green-600'
    case 'incomplete':
      return 'bg-red-600'
    case 'fetching':
      return 'bg-blue-600'
    default:
      return 'bg-neutral-600'
  }
}
