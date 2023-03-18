import {
  AnyAsset,
  ArgsTypeOf,
  Asset,
  JobConfig,
  JobGraph,
  JobQueueName,
} from './assets.types'

export function materialize<A extends AnyAsset>(
  asset: A,
  args: ArgsTypeOf<A>,
): JobGraph {
  const jobs: JobConfig[] = []

  jobs.push({
    id: 0,
    name: asset.name,
    queue: asset.queue,
  })

  return {
    jobs,
    dependencies: [],
  }
}

export function createLocalJob(id: number, name: string): JobConfig {
  return {
    id,
    name,
    queue: 'local',
  }
}

export function createApiJob(id: number, name: string): JobConfig {
  return {
    id,
    name,
    queue: 'api',
  }
}
