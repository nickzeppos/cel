import { AnyAsset, ArgsTypeOf, JobConfig, JobGraph } from './assets.types'

export function materialize<A extends AnyAsset>(
  asset: A,
  args: ArgsTypeOf<A>,
): JobGraph {
  const jobs: JobConfig[] = []

  jobs.push({
    id: 0,
    name: asset.name,
    queue: asset.queue,
    args,
  })

  return {
    jobs,
    dependencies: [],
  }
}

export function createLocalJob(
  id: number,
  name: string,
  args: unknown[] = [],
): JobConfig {
  return {
    id,
    name,
    queue: 'local',
    args,
  }
}

export function createApiJob(
  id: number,
  name: string,
  args: unknown[] = [],
): JobConfig {
  return {
    id,
    name,
    queue: 'api',
    args,
  }
}
