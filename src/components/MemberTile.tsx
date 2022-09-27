import { Member } from '@prisma/client'
import Image from 'next/image'
import React from 'react'

interface Props {
  member: Member
  t?: string
  style?: React.CSSProperties
  isFirstCol?: boolean
  isFirstRow?: boolean
}

export default function MemberTile({
  member,
  t,
  style,
  isFirstCol = false,
  isFirstRow = false,
}: Props) {
  return (
    <div
      className={`flex bg-neutral-800 border-black border-r border-b ${
        isFirstRow ? 'border-t' : ''
      } ${isFirstCol ? 'border-l' : ''}`}
      style={style}
      key={member.bioguideId}
    >
      <div className="w-[98px] h-[98px] relative flex-shrink-0 overflow-hidden">
        {member.imageUrl && (
          <div className="bg-neutral-700 w-full h-full"></div>
          // <Image
          //   src={member.imageUrl}
          //   className="object-cover object-center"
          //   width={98}
          //   height={98}
          // />
        )}
      </div>
      <div className="px-2 py-1 flex-grow flex flex-col overflow-hidden border-l border-black">
        <div className="text-neutral-300 font-semibold truncate overflow-hidden mb-auto">
          {/* {t ?? ''} */}
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
      </div>
    </div>
  )
}

function timeRange(s: string, a: number | null, b: number | null): string {
  if (a == null && b == null) return `${s}:`
  return `${s}: ${a}—${b ?? ''}`
}
