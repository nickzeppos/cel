import { getAssetForName } from '../assets/assetDefinitions'
import {
  CongressAPIAssetJobData,
  CongressAPIAssetJobName,
  CongressAPIAssetJobResponse,
} from './types'
import { Job } from 'bullmq'

export default async function execute(
  job: Job<
    CongressAPIAssetJobData,
    CongressAPIAssetJobResponse,
    CongressAPIAssetJobName
  >,
): Promise<CongressAPIAssetJobResponse> {
  console.log('Running congress api asset worker')
  console.log(job.queueName)
  console.log(job.name)
  console.log(job.data)

  const asset = getAssetForName(job.name)
  const deps = asset.deps as AnyAsset[]
  const args = [...Object.values(job.data)]

  const depsData = await Promise.all(
    deps.map((dep) => {
      return dep.read(args)
    }),
  )
  const policyOutcome = await asset.policy(args)
  if (policyOutcome) {
    console.log('Asset policy passed, reading asset')
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const data = await asset.read(args)
    return { message: 'Asset read', data }
  } else {
    console.log('Asset policy failed, creating asset')
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const data = await asset.create(args)(...depsData)
    await asset.write(args)(data)
    return { message: 'Asset created', data }
  }
}
