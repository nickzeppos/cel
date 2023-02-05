import {
  AnyAsset,
  Asset,
  AssetArray,
  DataTypesOf,
  membersCountAsset,
} from './assets'
import {
  CongressAPIAssetJobData,
  CongressAPIAssetJobName,
  CongressAPIAssetJobResponse,
} from './types'
import { Job } from 'bullmq'

export default async function (
  job: Job<
    CongressAPIAssetJobData,
    CongressAPIAssetJobResponse,
    CongressAPIAssetJobName
  >,
): Promise<CongressAPIAssetJobResponse> {
  // const { chamber, congress, offset, limit } = job.data
  console.log('running worker')

  await materialize(membersCountAsset, [], [])

  console.log('worker done')
  return {
    message: 'done',
  }
}

async function materialize<T, A extends any[], D extends AnyAsset[]>(
  asset: Asset<T, A, D>,
  args: A,
  deps: D,
): Promise<void> {
  console.log('calling materialize in the worker')
  // TODO: figure out how to get typescript to retain the
  // ordered mapping of each dependency's data type without `as`
  const materializedDeps = deps.map((d) => d.read()) as DataTypesOf<D>
  console.log('materialized deps', materializedDeps)
  if (!asset.policies(...args)) {
    console.log('policy failed')
    const materializedData = await asset.materialize(...materializedDeps)(
      ...args,
    )
    asset.persist(materializedData)
  } else {
    console.log('policy passed')
  }
}
