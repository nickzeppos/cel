import { Member } from '@prisma/client'
import Image from 'next/image'
import React from 'react'

interface Props {
  member: Member
  t?: string
  style?: React.CSSProperties
}

export default function MemberTile({ member, t, style }: Props) {
  return (
    <div
      className="flex gap-1 rounded-xl bg-neutral-800"
      style={style}
      key={member.bioguideId}
    >
      <div className="grid place-items-center w-[100px] h-[100px] relative flex-shrink-0">
        {member.imageUrl && (
          <Image
            src={member.imageUrl}
            className="object-cover object-center rounded-l-xl"
            layout={'fill'}
          />
        )}
      </div>
      <div className="p-1 flex-grow flex flex-col overflow-hidden">
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
