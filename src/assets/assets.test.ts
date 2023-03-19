import type { AnyAsset, Asset, JobQueueName } from './assets.types'
import { getJobGraphForAsset } from './engine'

describe('getJobGraphForAsset', () => {
  const membersCountAsset = getAssetExample('membersCount', 'api', [])
  const membersAsset = getAssetExample('members', 'api', [membersCountAsset])
  const bioguidesAsset = getAssetExample('bioguides', 'api', [membersAsset])
  const billsCountAsset = getAssetExample('billsCount', 'api', [])
  const actionsAsset = getAssetExample('actions', 'api', [billsCountAsset])
  const billsAsset = getAssetExample('bills', 'api', [billsCountAsset])
  const reportAsset = getAssetExample('report', 'local', [
    bioguidesAsset,
    membersAsset,
    actionsAsset,
    billsAsset,
  ])

  it('should queue one local job', () => {
    const actual = getJobGraphForAsset(membersCountAsset)
    expect(actual.jobs).toEqual([
      { id: 0, name: 'membersCount', queue: 'api', args: [] },
    ])
    expect(actual.dependencies).toEqual([])
  })

  it('should support assets with dependencies', () => {
    const actual = getJobGraphForAsset(membersAsset)
    expect(actual.jobs).toEqual([
      { id: 0, name: 'members', queue: 'api', args: [] },
      { id: 1, name: 'membersCount', queue: 'api', args: [] },
    ])
    expect(actual.dependencies).toEqual([{ job: 0, dependsOn: 1 }])
  })

  it('should support assets with two layers of dependencies', () => {
    const actual = getJobGraphForAsset(bioguidesAsset)
    expect(actual.jobs).toEqual([
      { id: 0, name: 'bioguides', queue: 'api', args: [] },
      { id: 1, name: 'members', queue: 'api', args: [] },
      { id: 2, name: 'membersCount', queue: 'api', args: [] },
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
      { id: 0, name: 'report', queue: 'local', args: [] },
      { id: 1, name: 'bioguides', queue: 'api', args: [] },
      { id: 2, name: 'members', queue: 'api', args: [] },
      { id: 3, name: 'membersCount', queue: 'api', args: [] },
      { id: 4, name: 'actions', queue: 'api', args: [] },
      { id: 5, name: 'billsCount', queue: 'api', args: [] },
      { id: 6, name: 'bills', queue: 'api', args: [] },
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

function getAssetExample<D extends AnyAsset[]>(
  name: string,
  queue: JobQueueName,
  deps: D,
): Asset<string, [], D> {
  return {
    name,
    queue,
    deps,
    policy: async () => false,
    write: () => async () => {
      return
    },
    read: async () => 'data',
    create: () => async () => 'data',
  }
}
