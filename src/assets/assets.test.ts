import type { Asset, AssetName } from './assets.types'
import { createApiJob, createLocalJob, materialize } from './engine'

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

    const jobConfig = materialize(simpleAsset, [])

    expect(jobConfig).toEqual({
      jobs: [createLocalJob(0, 'report')],
      dependencies: [],
    })
  })

  // it('should support assets with args', () => {})
})
