import { Asset } from './assets.types'
import { readFileSync, writeFileSync } from 'fs'
import { z } from 'zod'

const ALWAYS_FETCH_POLICY = async () => false

export const membersCountAsset: Asset<number, [], []> = {
  name: 'membersCount',
  queue: 'congress-api-asset-queue',
  deps: [],
  policy: ALWAYS_FETCH_POLICY,
  write: () => async () => {
    return
  },
  read: async () => 0,
  create: () => async () => 0,
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const oldMembersCountAsset = {
  deps: [],
  policy: ALWAYS_FETCH_POLICY,
  // materialize: () => async () => {
  //   console.log('IM INSIDE MATERIALIZED')
  //   const rawRes = await fetchCongressAPI('/member', { limit: 1 })
  //   const json = await rawRes.json()
  //   const data = allMemberResponseValidator.parse(json)
  //   const { count } = data.pagination
  //   return count
  // },
  write: () => async (count: number) => {
    console.log('saving count to file')
    try {
      writeFileSync('./data/members-count.txt', `${count}`, {
        encoding: 'utf8',
        flag: 'w',
      })
    } catch (e) {
      console.error(e)
    }
  },
  read: async () => {
    console.log('reading count from file')
    try {
      const text = readFileSync('./data/members-count.txt', {
        encoding: 'utf8',
        flag: 'r',
      })
      // If we upgrade to >= zod 3.20, we can use z.coerce in place of parseInt
      // https://github.com/colinhacks/zod/releases
      // z.coerce.number().int().positive().parse(text)
      const int = parseInt(text)
      const schema = z.number().int().positive()
      return schema.parse(int)
    } catch (e) {
      console.error(e)
    }
    throw new Error('failed to read')
  },
  name: '',
  queue: 'local',
  create: function (): <DD extends []>(...depsData: DD) => Promise<number> {
    throw new Error('Function not implemented.')
  },
}

// export const membersBiouguideListAsset: Asset<
//   string[],
//   [],
//   [typeof membersCountAsset]
// > = {
//   deps: [membersCountAsset],
//   policy: (_membersCountAsset) => async () => {
//     console.log('running  bioguide list policy')
//     return existsSync('./data/members-bioguide.txt') ? true : false
//   },
//   // materialize: (_membersCountAsset) => async (offset, limit) => {
//   //   const rawRes = await fetchCongressAPI('/member', { limit, offset })
//   //   const json = await rawRes.json()
//   //   const { members } = allMemberResponseValidator.parse(json)
//   //   return members.map((member) => member.bioguideId)
//   // },
//   write: () => async (bioguides) => {
//     console.log('saving bioguides to file')
//     const path = `./data/members-bioguides.txt`
//     try {
//       writeFileSync(path, `${bioguides.join('\n')}`, {
//         encoding: 'utf8',
//         flag: 'w',
//       })
//     } catch (e) {
//       console.error(e)
//     }
//   },
//   read: async () => {
//     console.log('reading bioguides from file')
//     try {
//       const text = readFileSync(`/data/member-bioguides.txt`, {
//         encoding: 'utf8',
//         flag: 'r',
//       })
//       const stringArray = text.split('\n')
//       return z.array(z.string()).parse(stringArray)
//     } catch (e) {
//       console.error(e)
//     }
//     throw new Error('Failed to read bioguides')
//   },
// }
