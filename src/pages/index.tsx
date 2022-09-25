import { NextPage } from 'next'
import { useState } from 'react'
import { trpc } from '../utils/trpc'
import React from 'react'
import { Chambress, Congress } from '@prisma/client'

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
      <div className="p-2 border-b border-neutral-600">
        <h1>Admin</h1>
      </div>
      <div className="p-2 flex flex-row gap-2">
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
