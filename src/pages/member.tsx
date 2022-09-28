import { NextPage } from 'next'
import Image from 'next/image'
import AdminHeader from '../components/AdminHeader'
import MemberTile from '../components/MemberTile'
import { trpc } from '../utils/trpc'
import { FixedSizeGrid as Grid, GridChildComponentProps } from 'react-window'
import { useCallback, useMemo, useRef } from 'react'
import { member } from 'fp-ts/lib/ReadonlyMap'
import AutoSizr from 'react-virtualized-auto-sizer'
import { useBoundingclientrect } from 'rooks'
import Button from '../components/Button'

const Member: NextPage = () => {
  const q = trpc.useQuery(['get-members'])
  const m = trpc.useMutation(['create-members'], {
    onSuccess: (data) => {
      console.log(data)
    },
  })
  const m2 = trpc.useMutation(['download-member-photos'])
  const m3 = trpc.useMutation(['square-image'])
  const m4 = trpc.useMutation(['pack-image'])
  // const numCols = useMemo(() => {
  //   if (rect == null) return 0
  //   return Math.floor(rect.width / 300)
  // }, [rect])
  // const Cell = useCallback(
  //   ({ rowIndex, columnIndex, isScrolling }: GridChildComponentProps) => {
  //     const member = members[rowIndex * numCols + columnIndex]
  //     if (member == null || isScrolling) {
  //       return <div>...</div>
  //     }
  //     return <MemberTile member={member} key={member.bioguideId} />
  //   },
  //   [q.data, rect],
  // )

  const members = q.data ?? []
  return (
    <div className="absolute inset-0 flex flex-col">
      <AdminHeader currentPage="member" />
      <div className="flex-grow border-b border-blue-400 flex flex-col">
        <div className="p-4">
          <Button
            label="Create Members"
            disabled={m.isLoading}
            onClick={() => {
              m.mutate()
            }}
          />
          <Button
            label="Download Images"
            disabled={m2.isLoading}
            onClick={() => {
              m2.mutate()
            }}
          />
          <Button
            label="Square Image"
            disabled={m3.isLoading}
            onClick={() => {
              m3.mutate()
            }}
          />
          <Button
            label="Pack Image"
            disabled={m4.isLoading}
            onClick={() => {
              m4.mutate()
            }}
          />
        </div>
        <div className="border border-black m-8 flex-grow relative overflow-hidden">
          <div className="absolute inset-4">
            <AutoSizr>
              {({ width, height }) => {
                const numCols = Math.floor(width / 300)
                const numRows = Math.ceil(members.length / numCols)

                return (
                  <Grid
                    columnCount={numCols}
                    columnWidth={300}
                    width={width}
                    rowCount={numRows}
                    rowHeight={100}
                    height={height}
                    overscanRowCount={10}
                  >
                    {({ rowIndex, columnIndex, style }) => {
                      const i = rowIndex * numCols + columnIndex
                      const member = members[i] ?? null
                      if (member == null) {
                        return <div key={i}>...</div>
                      }
                      return (
                        <MemberTile
                          style={style}
                          member={member}
                          key={member.bioguideId}
                          t={`${rowIndex}:${columnIndex}-${i}`}
                          isFirstCol={columnIndex === 0}
                          isFirstRow={rowIndex === 0}
                        />
                      )
                    }}
                  </Grid>
                )
              }}
            </AutoSizr>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Member
