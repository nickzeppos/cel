import { trpc } from '../utils/trpc'
import { Chamber } from '.prisma/client'
import clsx from 'clsx'

interface Props {
  chamber: Chamber
  congress: number
}
export default function BillsCountAssetCard({ chamber, congress }: Props) {
  const assetState = trpc.useQuery([
    'asset-playground.get-bills-count-asset-state',
    { chamber, congress },
  ])
  return (
    <div className="flex flex-col items-center w-full">
      <div
        className={clsx(
          assetState.data?.fileExists ? 'text-green-500' : 'text-red-500',
          'text-4xl text-neutral-200',
        )}
      >
        {assetState.data?.fileExists ? '✅' : '❌'}
      </div>
      <div className="text-sm text-neutral-500">
        Bill count file for {congress} {chamber}
      </div>
    </div>
  )
}
