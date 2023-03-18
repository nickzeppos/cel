import type { Asset } from './assets.types'
import { materialize } from './engine'

describe('materialize a simple asset with no dependencies', () => {
  const simpleAsset: Asset<string, [], []> = {
    name: 'report',
    queue: 'local',
    deps: [],
    policy: async () => false,
    write: () => async () => {
      return
    },
    read: async () => 'data',
    create: () => async () => 'data',
  }

  it('should queue one local job', () => {
    expect(materialize(simpleAsset, [])).toEqual({
      jobs: [{ id: 0, name: 'report', queue: 'local', args: [] }],
      dependencies: [],
    })
  })

  it('should support assets with args', () => {
    const assetWithArgs: Asset<string, [string, number], []> = {
      name: 'report',
      queue: 'local',
      deps: [],
      policy: async () => false,
      write: () => async () => {
        return
      },
      read: async () => 'data',
      create: () => async () => 'data',
    }

    expect(materialize(assetWithArgs, ['args', 1])).toEqual({
      jobs: [{ id: 0, name: 'report', queue: 'local', args: ['args', 1] }],
      dependencies: [],
    })

    expect(materialize(assetWithArgs, ['other args', 2])).toEqual({
      jobs: [
        { id: 0, name: 'report', queue: 'local', args: ['other args', 2] },
      ],
      dependencies: [],
    })
  })

  it('should support assets with dependencies', () => {
    const assetWithDeps: Asset<string, [], [Asset<string, [], []>]> = {
      name: 'report2',
      queue: 'local',
      deps: [simpleAsset],
      policy: async () => false,
      write: () => async () => {
        return
      },
      read: async () => 'data',
      create: () => async (simpleData) => `${simpleData} + complex data`,
    }

    expect(materialize(assetWithDeps, [])).toEqual({
      jobs: [
        { id: 0, name: 'report', queue: 'local', args: [] },
        { id: 1, name: 'report2', queue: 'local', args: [] },
      ],
      dependencies: [{ job: 0, dependsOn: 1 }],
    })
  })
})
