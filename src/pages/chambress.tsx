import { NextPage } from 'next'
import { trpc } from '../utils/trpc'
import React from 'react'
import { Chambress } from '@prisma/client'
import AdminHeader from '../components/AdminHeader'

const Home: NextPage = () => {
  const chambresses = trpc.useQuery(['get-chambresses'])
  const createMutation = trpc.useMutation(['create-chambresses'], {
    onSuccess(data) {
      if (data == null) {
        return
      }
      console.log(data)
      chambresses.refetch()
    },
  })
  const deleteMutation = trpc.useMutation(['delete-chambresses'], {
    onSuccess(data) {
      if (data == null) {
        return
      }
      console.log(data)
      chambresses.refetch()
    },
  })

  return (
    <div>
      <AdminHeader currentPage="chambress" />
      <div className="p-4 flex flex-row gap-2">
        <button
          className="bg-neutral-600 rounded-md p-2"
          disabled={createMutation.isLoading}
          onClick={() => {
            createMutation.mutate()
          }}
        >
          Populate Chambresses
        </button>
        <button
          className="bg-neutral-600 rounded-md p-2"
          disabled={deleteMutation.isLoading}
          onClick={() => {
            deleteMutation.mutate()
          }}
        >
          Delete Chambresses
        </button>
      </div>
      <div className="w-full place-content-center p-2 grid grid-cols-[repeat(auto-fill,200px)] grid-rows-[repeat(auto-fill,100px)] gap-2">
        {chambresses.isLoading && <div>Loading chambresses...</div>}
        {(chambresses.data ?? []).map((c) => (
          <ChambressTile key={c.id} chambress={c} />
        ))}
      </div>
    </div>
  )
}

export default Home

function ChambressTile({ chambress }: { chambress: Chambress | null }) {
  if (chambress == null) return null
  return (
    <div className="rounded-lg bg-neutral-800 w-[200px] h-[100px] p-2">
      {chambress.congress} {chambress.chamber}
    </div>
  )
}
