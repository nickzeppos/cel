import { AnyAsset, Asset, JobConfig, JobGraph, JobID } from './assets.types'
import { FlowJob, FlowProducer } from 'bullmq'

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

export function sortJobGraph(graph: JobGraph): number[] {
  const sorted: number[] = []
  const visited: Set<number> = new Set()
  const visiting: Set<number> = new Set()

  const visit = (job: number) => {
    if (visiting.has(job)) {
      throw new Error('cycle detected')
    }
    if (visited.has(job)) {
      return
    }
    visiting.add(job)
    graph.dependencies
      .filter((edge) => edge.dependsOn === job)
      .forEach((edge) => visit(edge.job))
    visiting.delete(job)
    visited.add(job)
    sorted.unshift(job)
  }

  graph.jobs.forEach((job) => visit(job.id))

  return sorted
}

export function getFlowForJobList(
  graph: JobGraph,
  sortedJobList: number[],
): FlowJob {
  let result: FlowJob | undefined = undefined

  for (const jobID of sortedJobList) {
    const job = graph.jobs.find((job) => job.id === jobID)!
    const flowJob = {
      name: job.name,
      queueName: job.queue,
      children: [],
    }
    result = flowJob
  }

  return result!
}
