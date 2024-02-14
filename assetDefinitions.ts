import { allMembersAsset } from './src/assets/allMembers.asset'
import { AnyAsset, Asset } from './src/assets/assets.types'
import { billsAsset } from './src/assets/bills.asset'
import { billsCountAsset } from './src/assets/billsCount.asset'
import { importantListAsset } from './src/assets/importantList.asset'
import { membersCountAsset } from './src/assets/membersCount.asset'
import { rankingPhrasesAsset } from './src/assets/rankingPhrases.asset'
import { stepRegexesAsset } from './src/assets/stepRegexes.asset'
import { debug, isNotNull, writeFileSyncWithDir } from './src/assets/utils'
import { bioguidesAssetMetadataValidator } from './src/utils/validators'
import { throttledFetchCongressAPI } from './src/workers/congressAPI'
import {
  AllMember,
  Member,
  allMemberResponseValidator,
  allMemberValidator,
  memberResponseValidator,
  memberValidator,
} from './src/workers/validators'
import { Chamber } from '.prisma/client'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { z } from 'zod'

// Policy constants
export const CONGRESS_API_PAGE_SIZE_LIMIT = 250
const ALWAYS_FETCH_POLICY = () => async () => false
const NEVER_FETCH_POLICY = () => async () => true
const ONE_DAY_REFRESH = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// export const membersAsset: Asset<
//   Array<AllMember>,
//   [],
//   [typeof membersCountAsset],
//   unknown
// > = {
//   name: 'members',
//   queue: 'congress-api-asset-queue',
//   deps: [membersCountAsset],
//   policy: () => async () => {
//     // if meta or data file doesn't exist, policy fails
//     if (
//       !existsSync(`./data/${membersAsset.name}-meta.json`) ||
//       !existsSync(`./data/${membersAsset.name}.json`)
//     ) {
//       return false
//     }
//     // else, policy passes
//     return true
//   },
//   read: async () => {
//     const members = readFileSync(`./data/${membersAsset.name}.json`, 'utf8')
//     return z.array(allMemberValidator).parse(JSON.parse(members))
//   },
//   create: () => () => async (membersCount) => {
//     let totalCount = 0
//     let offset: string | number = 0
//     // eslint-disable-next-line prefer-const
//     let limit: string | number = 250
//     let members: Array<AllMember> = []

//     do {
//       console.log(
//         `Fetching members ${totalCount} - ${
//           totalCount + limit > membersCount ? membersCount : totalCount + limit
//         }`,
//       )
//       // fetch with throttled fetchCongressAPI
//       const res = await throttledFetchCongressAPI('/member', {
//         offset,
//         limit,
//       })
//       const json = await res.json()

//       const allMemberResponse = allMemberResponseValidator.safeParse(json)
//       if (!allMemberResponse.success) {
//         throw new Error(
//           `membersAsset.create: failed to parse response from /member`,
//         )
//       }
//       const newMembers = allMemberResponse.data.members
//       const parsed = newMembers.map(({ member }) => {
//         const allMember = allMemberValidator.safeParse(member)
//         if (!allMember.success) {
//           throw new Error(
//             `membersAsset.create: failed to parse member ${member.bioguideId}`,
//           )
//         }
//         return allMember.data
//       })
//       members = [...members, ...parsed]
//       totalCount += parsed.length
//       offset += limit
//     } while (totalCount < membersCount)

//     // write data file
//     writeFileSyncWithDir(
//       `./data/${membersAsset.name}.json`,
//       JSON.stringify(members),
//     )

//     // write meta file
//     writeFileSyncWithDir(
//       `./data/${membersAsset.name}-meta.json`,
//       new Date().toString(),
//     )
//   },
// }
function bioguideFile(bioguideId: string): string {
  return `./data/bioguides/${bioguideId}.json`
}
function bioguideMetaFile(): string {
  return `./data/bioguides/meta.json`
}
// export const bioguidesAsset: Asset<
//   Array<Member>,
//   [],
//   [typeof membersAsset],
//   unknown
// > = {
//   name: 'bioguides',
//   queue: 'congress-api-asset-queue',
//   deps: [membersAsset],
//   policy: () => async (members: Array<AllMember>) => {
//     const missingBioguides = members
//       .map(({ bioguideId }) =>
//         existsSync(bioguideFile(bioguideId)) ? null : bioguideId,
//       )
//       .filter(isNotNull)
//     const metaFile = bioguideMetaFile()
//     debug('bioguidesAsset.policy', `writing ${metaFile}`)
//     writeFileSyncWithDir(
//       metaFile,
//       JSON.stringify({
//         lastPolicyRunTime: new Date().getTime(),
//         missingBioguides,
//       }),
//     )
//     return missingBioguides.length === 0
//   },
//   read: async () => {
//     const fileList = readdirSync(`./data/${bioguidesAsset.name}`)
//     let bioguides: Array<Member> = []
//     for (const file of fileList) {
//       const fileContents = readFileSync(
//         `./data/${bioguidesAsset.name}/${file}`,
//         'utf8',
//       )
//       const json = JSON.parse(fileContents)
//       bioguides = [...bioguides, memberValidator.parse(json)]
//     }
//     return bioguides
//   },
//   create:
//     ({ emit }) =>
//     () =>
//     // TODO: Unused deps right now because of how we're using members in the policy now to determine missing data
//     async (_members) => {
//       const metaFile = bioguideMetaFile()
//       const metaFileExists = existsSync(metaFile)
//       if (!metaFileExists) {
//         throw new Error(`expected meta file to exist: ${metaFile}`)
//       }
//       const metaFileRaw = readFileSync(metaFile, 'utf8')
//       const metaFileJSON = JSON.parse(metaFileRaw)
//       const metaFileParsed =
//         bioguidesAssetMetadataValidator.safeParse(metaFileJSON)
//       if (!metaFileParsed.success) {
//         throw new Error(`failed to parse bioguides meta file`)
//       }
//       const { missingBioguides } = metaFileParsed.data
//       let bioguides: Array<Member> = []

//       for (const bioguide of missingBioguides) {
//         debug('bioguidesAsset.create', `fetching ${bioguide}`)
//         const res = await throttledFetchCongressAPI(`/member/${bioguide}`)
//         debug('bioguidesAsset.create', `parsing ${bioguide}`)
//         const { json } = await res.json()
//         const bioguideMemberResponse = memberResponseValidator.safeParse(json)
//         if (!bioguideMemberResponse.success) {
//           throw new Error(`failed to parse response for ${bioguide}`)
//         }
//         const { member } = bioguideMemberResponse.data

//         // write data file
//         debug('bioguidesAsset.create', `writing ${bioguideFile(bioguide)}`)
//         writeFileSyncWithDir(bioguideFile(bioguide), JSON.stringify(member))
//       }
//     },
// }

export type AssetNameOf<T extends AnyAsset> = T['name']

const allAssets = {
  membersCount: membersCountAsset,
  billsCount: billsCountAsset,
  bills: billsAsset,
  allMembers: allMembersAsset,
  importantList: importantListAsset,
  stepRegexes: stepRegexesAsset,
  rankingPhrases: rankingPhrasesAsset,
  // bioguides: bioguidesAsset,
  // members: membersAsset,
  // billsList: billsListAsset,
  // report: reportAsset,
} as const

export type AssetName = keyof typeof allAssets

export function getAssetForName(name: AssetName): AnyAsset {
  const asset = allAssets[name]

  if (asset == null) {
    console.error(`No asset with name ${name}`)
  }
  return asset
}

export function getAssetNames(): AssetName[] {
  return Object.keys(allAssets) as AssetName[]
}

export function isAssetName(name: string): name is AssetName {
  return name in allAssets
}
