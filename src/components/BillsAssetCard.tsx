import { trpc } from '../utils/trpc'
import { Chamber } from '@prisma/client'

interface Props {
  chamber: Chamber
  congress: number
}
export default function BillsAssetCard({ chamber, congress }: Props) {
  const assetState = trpc.useQuery([
    'asset-playground.get-bills-asset-state',
    { chamber, congress },
  ])
  return (
    <div className="flex flex-col items-center w-full">
      <div className="text-4xl text-neutral-200">
        {assetState.data?.count ?? 'unknown'}
      </div>
      <div className="text-sm text-neutral-500">
        Bills metadata in {congress} {chamber}
      </div>
    </div>
  )
}
