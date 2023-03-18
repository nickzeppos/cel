import type { Asset } from './assets.types'
import { createLocalJob, materialize } from './engine'

describe('materialize a simple asset with no dependencies', () => {
  it('should queue one local job', () => {
    const simpleAsset: Asset<string, [], []> = {
      name: 'report',
      queue: 'local',
      deps: [],
      policy: () => async () => false,
      write: () => async () => {
        return
      },
      read: async () => 'data',
    }

    expect(materialize(simpleAsset, [])).toEqual({
      jobs: [createLocalJob(0, 'report')],
      dependencies: [],
    })
  })

  it('should support assets with args', () => {
    const assetWithArgs: Asset<string, [string], []> = {
      name: 'report',
      queue: 'local',
      deps: [],
      policy: () => async () => false,
      write: () => async () => {
        return
      },
      read: async () => 'data',
    }

    expect(materialize(assetWithArgs, ['args'])).toEqual({
      jobs: [createLocalJob(0, 'report', ['args'])],
      dependencies: [],
    })

    expect(materialize(assetWithArgs, ['other args'])).toEqual({
      jobs: [createLocalJob(0, 'report', ['other args'])],
      dependencies: [],
    })
  })
})
