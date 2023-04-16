import { getAssetForName } from '../assets/assetDefinitions'
import {
  CongressAPIAssetJobData,
  CongressAPIAssetJobName,
  CongressAPIAssetJobResponse,
} from './types'
import { Job } from 'bullmq'
import { format } from 'date-fns'

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

  try {
    const asset = getAssetForName(job.name)
    const deps = asset.deps as AnyAsset[]

    const args = job.data
    debug(`Reading asset ${asset.name} with args ${JSON.stringify(args)}`)

    const depsData = await Promise.all(
      deps.map((dep) => {
        return dep.read(...args)
      }),
    )

    const emit = <T extends object>(data: T) => {
      job.updateProgress(data)
    }

    const policyOutcome = await asset.policy(...args)(...depsData)
    if (policyOutcome) {
      debug('Asset policy passed, reading asset')
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const data = await asset.read(...args)
      return { message: 'Asset read', data }
    } else {
      debug('Asset policy failed, creating asset')
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const data = await asset.create({ emit })(...args)(...depsData)
      return { message: 'Asset created', data }
    }
  } catch (e) {
    error(e)
    return { message: 'Asset failed', data: e.message }
  }
}

function debug(message: string): void {
  console.debug(
    `[APIWorker | ${format(Date.now(), 'HH:mm:ss.SSS')}]: ${message}`,
  )
}

function error(message: string): void {
  console.error(
    `[APIWorker | ${format(Date.now(), 'HH:mm:ss.SSS')}]: ${message}`,
  )
}
