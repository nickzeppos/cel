import { trpc } from '../utils/trpc'
import { Member, Term } from '@prisma/client'
import React from 'react'

interface Props {
  member: Member
  style?: React.CSSProperties
  isFirstCol?: boolean
  isFirstRow?: boolean
}

export default function MemberTile({
  member,
  style,
  isFirstCol = false,
  isFirstRow = false,
}: Props) {
  const terms = trpc.useQuery([
    'member.get-terms-for-member',
    { bioguideId: member.bioguideId },
  ])
  const tileBackground =
    terms.data?.length! > 0 ? 'bg-emerald-900/[0.2]' : 'bg-red-900/[0.2]'
  return (
    <div
      className={`flex bg-neutral-800 border-black border-r border-b ${
        isFirstRow ? 'border-t' : ''
      } ${isFirstCol ? 'border-l' : ''}`}
      style={style}
      key={member.bioguideId}
    >
      <div className="w-[98px] h-[98px] relative flex-shrink-0 overflow-hidden">
        {member.spriteCol != null && member.spriteRow != null && (
          <div
            className="bg-no-repeat w-[98px] h-[98px]"
            style={{
              backgroundImage: `url('/congress.jpg')`,
              backgroundPosition: `${-98 * member.spriteCol}px ${
                -98 * member.spriteRow
              }px`,
            }}
          />
        )}
      </div>
      <div
        className={`px-2 py-1 flex-grow flex flex-col overflow-hidden border-l border-black ${tileBackground}`}
      >
        <div className="text-neutral-300 font-semibold truncate overflow-hidden mb-auto">
          {member.name}
        </div>
        <div className="text-neutral-600 text-sm">
          {`(${member.party.substring(0, 1)}) ${member.state}`}
        </div>
        <div className="text-neutral-600 text-sm">
          {timeRange('S', member.servedSenateStart, member.servedSenateEnd)}
        </div>
        <div className="text-neutral-600 text-sm">
          {timeRange('H', member.servedHouseStart, member.servedHouseEnd)}
        </div>
        <div></div>
      </div>
    </div>
  )
}

function timeRange(s: string, a: number | null, b: number | null): string {
  if (a == null && b == null) return `${s}:`
  return `${s}: ${a}—${b ?? ''}`
}
