import { NextPage } from "next"
import { useState } from "react"
import { trpc } from "../utils/trpc"
import React from "react"
import { Congress } from "@prisma/client"

const randomCongress = (): number => {
  return Math.round(Math.random() * (117 - 93) + 93)
}
const congressNums = Array.from(new Array(118 - 93)).map((_, i) => i + 93)

const Home: NextPage = () => {
  const [congressNum, setCongressNum] = useState<number>(93)
  // const [congress, setCongress] = useState<Congress | null>(null)
  const ctx = trpc.useContext()
  const allCongs = trpc.useQuery(["get-all-cong"])
  const congData: Congress[] = allCongs.data ?? []
  const mutation = trpc.useMutation(["get-cong-by-num"], {
    onSuccess(data, variables, context) {
      if (data == null) {
        return
      }
      // TODO: insert data in sorted order since that's what we expect from the server
      // maybe insert like this, then just sort after
      ctx.queryClient.setQueryData("get-all-cong", [...congData, data])
      // setCongress(data)
      // allCongs.refetch()
    },
  })
  return (
    <div>
      <div className="p-2 border-b border-neutral-600">
        <h1>Admin</h1>
      </div>
      <div className="p-2 flex flex-col gap-2">
        {congressNums
          .filter((n) => congData.findIndex((c) => c.congress === n) === -1)
          .map((n) => (
            <button
              key={n}
              className="bg-neutral-600 rounded-md p-2"
              onClick={() => {
                mutation.mutate({ number: n })
              }}
            >
              {n}
            </button>
          ))}
      </div>
      <div className="p-2 flex flex-col gap-2">
        <div className="p-2 flex gap-2">
          <button
            className="bg-neutral-600 rounded-md p-2"
            disabled={mutation.isLoading}
            onClick={() => {
              mutation.mutate({ number: congressNum })
            }}
          >
            {`${
              mutation.isLoading ? "Loading" : "Create"
            } congress ${congressNum}`}
          </button>
          <input
            className="flex-grow"
            type="range"
            value={congressNum}
            min={93}
            max={117}
            onChange={(e) => {
              setCongressNum(e.target.valueAsNumber)
            }}
          />
        </div>
        <div className="w-full place-content-center p-2 grid grid-cols-[repeat(auto-fill,200px)] grid-rows-[repeat(auto-fill,100px)] gap-2">
          {allCongs.isLoading && <div>Loading all congs</div>}
          {congData.map((c) => (
            <CongressTile key={c.id} congress={c} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Home

function CongressTile({ congress }: { congress: Congress | null }) {
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
