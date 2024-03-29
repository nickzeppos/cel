import { FlowJob } from 'bullmq'
import type { AnyAsset, Asset, JobQueueName } from './assets.types'
import { getFlowForJobList, getJobGraphForAsset, sortJobGraph } from './engine'

const membersCountAsset = getAssetExample(
  'membersCount',
  'congress-api-asset-queue',
  [],
)

const membersAsset = getAssetExample('members', 'congress-api-asset-queue', [
  membersCountAsset,
])
const bioguidesAsset = getAssetExample(
  'bioguides',
  'congress-api-asset-queue',
  [membersAsset],
)
const billsCountAsset = getAssetExample(
  'billsCount',
  'congress-api-asset-queue',
  [],
)
const billAsset = getAssetExample('actions', 'congress-api-asset-queue', [
  billsCountAsset,
])
const billListAsset = getAssetExample('bills', 'congress-api-asset-queue', [
  billsCountAsset,
])
const reportAsset = getAssetExample('report', 'local-asset-queue', [
  bioguidesAsset,
  membersAsset,
  billAsset,
  billListAsset,
])

describe('getJobGraphForAsset', () => {
  it('should queue one local job', () => {
    const actual = getJobGraphForAsset(membersCountAsset)
    expect(actual.jobs).toEqual([
      {
        id: 0,
        name: 'membersCount',
        queue: 'congress-api-asset-queue',
        args: [],
      },
    ])
    expect(actual.dependencies).toEqual([])
  })

  it('should support assets with dependencies', () => {
    const actual = getJobGraphForAsset(membersAsset)
    expect(actual.jobs).toEqual([
      { id: 0, name: 'members', queue: 'congress-api-asset-queue', args: [] },
      {
        id: 1,
        name: 'membersCount',
        queue: 'congress-api-asset-queue',
        args: [],
      },
    ])
    expect(actual.dependencies).toEqual([{ job: 0, dependsOn: 1 }])
  })

  it('should support assets with two layers of dependencies', () => {
    const actual = getJobGraphForAsset(bioguidesAsset)
    expect(actual.jobs).toEqual([
      { id: 0, name: 'bioguides', queue: 'congress-api-asset-queue', args: [] },
      { id: 1, name: 'members', queue: 'congress-api-asset-queue', args: [] },
      {
        id: 2,
        name: 'membersCount',
        queue: 'congress-api-asset-queue',
        args: [],
      },
    ])
    expect(actual.dependencies).toHaveLength(2)
    expect(actual.dependencies).toEqual(
      expect.arrayContaining([
        { job: 0, dependsOn: 1 },
        { job: 1, dependsOn: 2 },
      ]),
    )
  })

  it('should support a complex graph', () => {
    const actual = getJobGraphForAsset(reportAsset)
    expect(actual.jobs).toEqual([
      { id: 0, name: 'report', queue: 'local-asset-queue', args: [] },
      { id: 1, name: 'bioguides', queue: 'congress-api-asset-queue', args: [] },
      { id: 2, name: 'members', queue: 'congress-api-asset-queue', args: [] },
      {
        id: 3,
        name: 'membersCount',
        queue: 'congress-api-asset-queue',
        args: [],
      },
      { id: 4, name: 'actions', queue: 'congress-api-asset-queue', args: [] },
      {
        id: 5,
        name: 'billsCount',
        queue: 'congress-api-asset-queue',
        args: [],
      },
      { id: 6, name: 'bills', queue: 'congress-api-asset-queue', args: [] },
    ])
    expect(actual.dependencies).toHaveLength(8)
    expect(actual.dependencies).toEqual(
      expect.arrayContaining([
        { job: 0, dependsOn: 1 },
        { job: 1, dependsOn: 2 },
        { job: 2, dependsOn: 3 },
        { job: 0, dependsOn: 2 },
        { job: 0, dependsOn: 4 },
        { job: 4, dependsOn: 5 },
        { job: 0, dependsOn: 6 },
        { job: 6, dependsOn: 5 },
      ]),
    )
  })
})

describe('sortJobGraph', () => {
  it('should sort a simple job graph that has no dependencies', () => {
    const jobGraph = getJobGraphForAsset(membersCountAsset)
    const actual = sortJobGraph(jobGraph)

    expect(actual).toEqual([0])
  })

  it('should sort a job graph with dependencies', () => {
    const jobGraph = getJobGraphForAsset(membersAsset)
    const actual = sortJobGraph(jobGraph)

    expect(actual).toEqual([1, 0])
  })

  it('should sort a complex job graph', () => {
    const jobGraph = getJobGraphForAsset(reportAsset)
    const actual = sortJobGraph(jobGraph)

    // loop over jobGraph.dependencies and check that each job is after its dependency
    jobGraph.dependencies.forEach(({ job, dependsOn }) => {
      expect(actual.indexOf(job)).toBeGreaterThan(actual.indexOf(dependsOn))
    })
  })
})

describe('getFlowForJobList', () => {
  const args = ['SENATE']
  it('should return a flow for a simple job list', () => {
    const jobGraph = getJobGraphForAsset(membersCountAsset)
    const sortedJobList = sortJobGraph(jobGraph)
    const actual = getFlowForJobList(jobGraph, sortedJobList, [])

    expect(actual).toEqual({
      name: 'membersCount',
      queueName: 'congress-api-asset-queue',
      children: [],
      data: [],
    })
  })

  it('should return a flow for a job list with dependencies', () => {
    const jobGraph = getJobGraphForAsset(membersAsset)
    const sortedJobList = sortJobGraph(jobGraph)
    const actual = getFlowForJobList(jobGraph, sortedJobList, [])

    expect(actual).toEqual({
      name: 'members',
      queueName: 'congress-api-asset-queue',
      children: [
        {
          name: 'membersCount',
          queueName: 'congress-api-asset-queue',
          children: [],
          data: [],
        },
      ],
      data: [],
    })
  })

  it('should return a flow for a complex job list', () => {
    const jobGraph = getJobGraphForAsset(reportAsset)
    const sortedJobList = sortJobGraph(jobGraph)
    const actual = getFlowForJobList(jobGraph, sortedJobList, [])

    jobGraph.dependencies.forEach(({ job, dependsOn }) => {
      let currentFlowJob: FlowJob | undefined = actual

      const descendChildrenToFindFlowJobMatching = (jobID: number) => {
        let found = false
        const jobConfig = jobGraph.jobs.find(
          (jobConfig) => jobConfig.id === jobID,
        )!
        while (!found && currentFlowJob !== undefined) {
          if (currentFlowJob.name === jobConfig.name) {
            found = true
          } else {
            currentFlowJob = currentFlowJob.children![0]
          }
        }
        return found
      }

      expect(descendChildrenToFindFlowJobMatching(job)).toBe(true)
      expect(descendChildrenToFindFlowJobMatching(dependsOn)).toBe(true)
    })
  })

  it('should return a flow for a simple job list with args', () => {
    const jobGraph = getJobGraphForAsset(membersCountAsset)
    const sortedJobList = sortJobGraph(jobGraph)
    const actual = getFlowForJobList(jobGraph, sortedJobList, args)

    expect(actual).toEqual({
      name: 'membersCount',
      queueName: 'congress-api-asset-queue',
      children: [],
      data: args,
    })
  })

  it('should pass the same args to every job and child in a complex flow', () => {
    const jobGraph = getJobGraphForAsset(reportAsset)
    const sortedJobList = sortJobGraph(jobGraph)
    const actual = getFlowForJobList(jobGraph, sortedJobList, args)

    const getNestedData = (job: FlowJob): any[] => {
      const res = []
      if (job.data) {
        res.push(job.data)
      }
      if (job.children) {
        job.children.forEach((child) => {
          res.push(...getNestedData(child))
        })
      }
      return res
    }

    // expect the parent FlowJob to have args for data
    expect(actual.data).toEqual(args)

    // expect every arg in the job graph to have same args
    expect(getNestedData(actual).every((data) => data === args)).toBe(true)
  })
})

function getAssetExample<D extends AnyAsset[]>(
  name: string,
  queue: JobQueueName,
  deps: D,
): Asset<string, [], D, unknown> {
  return {
    name,
    queue,
    deps,
    policy: () => async () => false,
    read: async () => 'data',
    create: () => () => async () => { },
  }
}
