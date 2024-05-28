import { getAssetForName } from '../../assetDefinitions'
import {
  LocalAssetJobData,
  LocalAssetJobName,
  LocalAssetJobResponse,
} from './types'
import { Job } from 'bullmq'
import { format } from 'date-fns'

// TODO: local asset .create() methods currently throw errors. I should probably consider how I want to handle
// this overall. Local assets are to my mind are those assets which CANNOT be created via web request.
// In practice, our local assets are data, structured in various ways, taht we inherit from PI's.
// For instance, a list of regular expressions that we use to match against a given string
// to determine whether it constitutes the achievement of a particular legislative step.
// Additionally, local requests have changed over time. So, the notion that we should have to "create" a local asset
// is a worthy goal, even though it might be infrequent. For instance, we have added regexes to the list of step regexes.
// It might be nice to facilitate this kind of thing, rather than relying on someone to slot in a new file, or edit the
// file that's in our resources folder.

export default async function execute(
  job: Job<LocalAssetJobData, LocalAssetJobResponse, LocalAssetJobName>,
): Promise<LocalAssetJobResponse> {
  console.log('Running local asset worker')
  console.log(job.name)
  console.log(job.queueName)
  console.log(job.data)

  const asset = getAssetForName(job.name)
  const args = job.data
  debug(`Reading asset ${asset.name} with args ${JSON.stringify(args)}`)

  try {
    const policyOutcome = await asset.policy(...args)()
    if (policyOutcome) {
      debug('Asset policy passed, reading asset')
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const data = await asset.read(...args)
      return { message: 'Asset read', data }
    } else {
      debug(`Local asset ${asset.name} failed policy check. Args: ${args}`)
      return { message: 'Asset failed', data: null }
    }
  } catch (e) {
    error(e)
  }
}

function debug(message: string): void {
  console.debug(
    `[LocalAssetWorker | ${format(Date.now(), 'HH:mm:ss.SSS')}]: ${message}`,
  )
}
function error(message: string): void {
  console.error(
    `[APIWorker | ${format(Date.now(), 'HH:mm:ss.SSS')}]: ${message}`,
  )
}
