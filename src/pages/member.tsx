import AdminHeader from '../components/AdminHeader'
import Button from '../components/Button'
import MemberTile from '../components/MemberTile'
import { trpc } from '../utils/trpc'
import { NextPage } from 'next'
import AutoSizr from 'react-virtualized-auto-sizer'
import { FixedSizeGrid as Grid } from 'react-window'

const Member: NextPage = () => {
  const membersQuery = trpc.useQuery(['member.get-all'])
  const createMembers = trpc.useMutation(['member.create-all'], {
    onSuccess: (data) => {
      console.log(data)
    },
  })
  const createTerms = trpc.useMutation(['member.create-terms'], {
    onSuccess: (data) => {
      console.log(data)
    },
  })
  const downloadPhotos = trpc.useMutation(['member.download-missing-photos'])
  const squareImage = trpc.useMutation(['member.square-image'])
  const packImage = trpc.useMutation(['member.pack-image'])

  const members = membersQuery.data ?? []
  return (
    <div className="absolute inset-0 flex flex-col">
      <AdminHeader currentPage="member" />
      <div className="flex flex-grow flex-col">
        <div className="p-4">
          <Button
            label="Create Members"
            disabled={createMembers.isLoading}
            onClick={() => {
              createMembers.mutate()
            }}
            className="p-2 mr-2 bg-neutral-600 rounded"
          />
          <Button
            label="Create Terms"
            disabled={createTerms.isLoading}
            onClick={() => {
              createTerms.mutate()
            }}
            className="p-2 mr-2 bg-neutral-600 rounded"
          />
          <Button
            label="Download Images"
            disabled={downloadPhotos.isLoading}
            onClick={() => {
              downloadPhotos.mutate()
            }}
            className="p-2 mr-2 bg-neutral-600 rounded"
          />
          <Button
            label="Square Image"
            disabled={squareImage.isLoading}
            onClick={() => {
              squareImage.mutate()
            }}
            className="p-2 mr-2 bg-neutral-600 rounded"
          />
          <Button
            label="Pack Image"
            disabled={packImage.isLoading}
            onClick={() => {
              packImage.mutate()
            }}
            className="p-2 mr-2 bg-neutral-600 rounded"
          />
        </div>
        <div className="relative flex-grow overflow-hidden">
          <div className="absolute inset-0">
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
