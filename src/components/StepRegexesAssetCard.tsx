import { trpc } from '../utils/trpc'
import { Chamber } from '@prisma/client'
import clsx from 'clsx'

interface Props {
  chamber: Chamber
}
export default function StepRegexesAssetCard({ chamber }: Props) {
  const assetMetadataQuery = trpc.useQuery([
    'asset-playground.get-stepRegexes-asset-metadata',
    { chamber },
  ])

  trpc.useSubscription(['asset-playground.on-change'], {
    onNext: (data) => {
      if (data.assetName !== 'stepRegexes') return
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
    return (
      <div>
        <div className="flex flex-col h-full gap-1 relative items-center justify-center w-full">
          <table className="w-full">
            <thead>
              <tr>
                <th>STEP</th>
                <th>Exists?</th>
                <th>Invalid Count</th>
              </tr>
            </thead>
            <tbody>
              {assetMetadataQuery.data?.fileStatuses.map((fileStatus) => (
                <tr
                  className="w-full text-sm text-center text-neutral-500"
                  key={fileStatus.step}
                >
                  <td>{fileStatus.step}</td>
                  <td>{fileStatus.exists ? '✅' : '❌'}</td>
                  <td>{fileStatus.invalidLineNumbers.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
}
