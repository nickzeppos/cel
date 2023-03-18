import {
  AnyAsset,
  Asset,
  JobConfig,
  JobEdge,
  JobGraph,
  JobID,
} from './assets.types'

export function materialize<
  T,
  A extends Array<unknown>,
  D extends Array<Asset<any, any, any>>,
>(asset: Asset<T, A, D>, args: A): JobGraph {
  const jobs: JobConfig[] = []
  const dependencies: JobEdge[] = []

  const assetStack: AnyAsset[] = [asset]
  const visitedDeps: WeakSet<AnyAsset> = new WeakSet()
  const assetJobMap: WeakMap<AnyAsset, JobID> = new WeakMap()

  const getJobConfig = (asset: AnyAsset): JobConfig => {
    return {
      id: id++,
      name: asset.name,
      queue: asset.queue,
      args,
    }
  }
  const getParentJobID = (): JobID | undefined => {
    const assetDownTheStack = assetStack[assetStack.length - 2]
    if (assetDownTheStack === undefined) {
      return undefined
    }
    return assetJobMap.get(assetDownTheStack)
  }

  let id = 0
  let currentAsset: AnyAsset | undefined = asset

  do {
    if (!visitedDeps.has(currentAsset)) {
      const jobConfig = getJobConfig(currentAsset)
      const job = getParentJobID()
      if (job !== undefined) {
        dependencies.push({ job, dependsOn: jobConfig.id })
      }
      assetJobMap.set(currentAsset, jobConfig.id)
      jobs.push(jobConfig)
      visitedDeps.add(currentAsset)
    }
    const deps = currentAsset.deps as AnyAsset[]
    const nextUnvisitedDep = deps.find((dep) => !visitedDeps.has(dep))

    if (nextUnvisitedDep !== undefined) {
      assetStack.push(nextUnvisitedDep)
    } else {
      assetStack.pop()
    }
    currentAsset = assetStack[assetStack.length - 1]
  } while (currentAsset !== undefined)

  return {
    jobs,
    dependencies,
  }
}
