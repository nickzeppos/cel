import { AnyAsset, Asset, JobConfig, JobGraph, JobID } from './assets.types'

export function getJobGraphForAsset<
  T,
  A extends unknown[],
  D extends AnyAsset[],
>(asset: Asset<T, A, D>): JobGraph {
  const jobs: JobConfig[] = []

  const assetStack: AnyAsset[] = [asset]
  const assetJobMap: WeakMap<AnyAsset, JobID> = new WeakMap()
  const visitedFrom: Map<AnyAsset, AnyAsset[]> = new Map()

  let id = 0
  let currentAsset: AnyAsset | undefined = asset

  const getJobConfig = (asset: AnyAsset): JobConfig => {
    return {
      id: id++,
      name: asset.name,
      queue: asset.queue,
      args: [],
    }
  }

  while (currentAsset !== undefined) {
    const asset = currentAsset

    // make a job for the current asset if it doesn't already exist
    if (!assetJobMap.has(asset)) {
      const jobConfig = getJobConfig(asset)
      jobs.push(jobConfig)
      assetJobMap.set(asset, jobConfig.id)
    }

    // go to the next unvisited dep or back up to parent
    const deps = asset.deps as AnyAsset[]
    const nextUnvisitedDep = deps.find((dep) => {
      const parents = visitedFrom.get(dep)
      if (parents === undefined) {
        return true
      }
      return !parents.includes(asset)
    })
    if (nextUnvisitedDep !== undefined) {
      assetStack.push(nextUnvisitedDep)
      if (!visitedFrom.has(nextUnvisitedDep)) {
        visitedFrom.set(nextUnvisitedDep, [currentAsset])
      } else {
        const parents = visitedFrom.get(nextUnvisitedDep)!
        if (!parents.includes(currentAsset)) {
          visitedFrom.set(nextUnvisitedDep, [...parents, currentAsset])
        }
      }
    } else {
      assetStack.pop()
    }
    currentAsset = assetStack[assetStack.length - 1]
  }

  const dependencies = [...visitedFrom.entries()].flatMap(
    ([asset, parents]) => {
      const dependsOn = assetJobMap.get(asset)!
      return parents.map((parent) => ({
        job: assetJobMap.get(parent)!,
        dependsOn,
      }))
    },
  )

  return {
    jobs,
    dependencies,
  }
}
