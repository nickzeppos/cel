import { NextPage } from "next"
import { useState } from "react"
import { trpc } from "../utils/trpc"
import React from "react"
import { Congress } from "@prisma/client"

const Home: NextPage = () => {
  const chambresses = trpc.useQuery(["get-chambresses"])
  const mutation = trpc.useMutation(["create-chambresses"], {
    onSuccess(data, variables, context) {
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
      <div className="p-2 flex flex-col gap-2">
          <button
            className="bg-neutral-600 rounded-md p-2"
            disabled={mutation.isLoading}
            onClick={() => { mutation.mutate() }}
          >
            Create Chambresses
          </button>
        </div>
        <div className="w-full place-content-center p-2 grid grid-cols-[repeat(auto-fill,200px)] grid-rows-[repeat(auto-fill,100px)] gap-2">
          {chambresses.isLoading && <div>Loading chambresses...</div>}
          {(chambresses.data ?? []).map((c) => (
            <ChambressTile key={c.id} chambress={c} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Home

function ChambressTile({ Chambress }: { Chambress: Chambress | null }) {
  if (congress == null) return null
  return (
    <div className="rounded-lg bg-neutral-800 w-[200px] h-[100px] p-2">
      <ul>
        <li>congress num: {congress?.congress}</li>
        <li>start year: {congress?.startYear}</li>
        <li>end year {congress?.endYear}</li>
      </ul>
    </div>
  )
}
