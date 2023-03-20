import { AssetName, getAssetNames } from '../assets/assetDefinitions'
import AdminHeader from '../components/AdminHeader'
import AssetGraphTiles from '../components/AssetGraphTiles'
import Button from '../components/Button'
import Selector from '../components/Selector'
import { ChamberToDisplay } from '../server/chambress'
import { trpc } from '../utils/trpc'
import { Chamber } from '@prisma/client'
import { JobState } from 'bullmq'
import clsx from 'clsx'
import { NextPage } from 'next'
import { useEffect, useState } from 'react'

const CHAMBERS: Chamber[] = ['HOUSE', 'SENATE']
// numbers from 93 to 117 as strings, but reversed
const CONGRESSESS = Array.from({ length: 25 }, (_, i) => 117 - i).map((i) =>
  i.toString(),
)
const ASSETS = getAssetNames()

const AssetPlayground: NextPage = () => {
  const [chamber, setChamber] = useState<Chamber>('HOUSE')
  const [congress, setCongress] = useState<string>('117')
  const [asset, setAsset] = useState<AssetName>('report')
  const [minBillNum, setMinBillNum] = useState<number | null>(null)
  const [maxBillNum, setMaxBillNum] = useState<number | null>(null)
  const [states, setStates] = useState<Record<AssetName, JobState | 'unknown'>>(
    {
      report: 'unknown',
      actions: 'unknown',
      bills: 'unknown',
      members: 'unknown',
      membersCount: 'unknown',
      billsCount: 'unknown',
      bioguides: 'unknown',
    },
  )
  const materialize = trpc.useMutation(['asset-playground.materialize'], {
    onSuccess: (data) => {
      console.log('job scheduled', data)
    },
  })
  trpc.useSubscription(['asset-playground.on-change'], {
    onNext: (data) => {
      console.log('on change', data)
      setStates((currentStates) => ({
        ...currentStates,
        [data.assetName]: data.jobState,
      }))
    },
  })

  return (
    <div>
      <AdminHeader currentPage="asset-playground" />
      <div className="p-4 max-w-xl flex flex-col gap-4">
        <div className="text-2xl font-bold">Args</div>
        <div className="flex flex-row gap-4">
          <div className="flex-grow">
            <Selector
              label="Chamber"
              value={chamber}
              options={CHAMBERS}
              onChange={setChamber}
              displayNames={ChamberToDisplay}
            />
          </div>
          <div className="w-[200px]">
            <Selector
              label="Congress"
              value={congress}
              options={CONGRESSESS}
              onChange={setCongress}
            />
          </div>
        </div>
        <Selector
          label="Asset"
          value={asset}
          options={ASSETS}
          onChange={setAsset}
        />
        <div className="text-sm font-medium">Bill Number Range</div>
        <div className="flex flex-row gap-4">
          <NumberTextField
            label="Min Bill Number"
            initialValue={minBillNum}
            onChange={setMinBillNum}
            placeholder="Min"
          />
          <NumberTextField
            label="Max Bill Number"
            initialValue={maxBillNum}
            onChange={setMaxBillNum}
            placeholder="Max"
          />
        </div>
        <Button
          label="Materialize"
          onClick={() => {
            const congressNumber = parseInt(congress)
            console.log(minBillNum, maxBillNum)
            materialize.mutate({
              chamber,
              congress: congressNumber,
              assetName: asset,
              minBillNum,
              maxBillNum,
            })
          }}
        />
      </div>
      <AssetGraphTiles states={states} />
    </div>
  )
}

export default AssetPlayground

function NumberTextField({
  label,
  initialValue,
  onChange,
  placeholder,
}: {
  label: string
  initialValue: number | null
  onChange: (value: number | null) => void
  placeholder?: string
}) {
  const [value, setValue] = useState(initialValue?.toString() ?? '')

  return (
    <input
      type="text"
      name={label}
      className={clsx(
        'relative block w-full py-2 px-3 focus:z-10',
        'rounded-md border-0',
        'bg-neutral-800 text-white placeholder:text-gray-500',
        'ring-1 ring-inset ring-neutral-700',
        'focus:ring-2 focus:ring-inset focus:ring-indigo-600',
      )}
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        const value = e.target.value
        const num = parseInt(value)
        if (isNaN(num)) {
          onChange(null)
        } else {
          onChange(num)
        }
        setValue(value)
      }}
    />
  )
}
