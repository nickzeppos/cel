import AdminHeader from '../components/AdminHeader'
import Button from '../components/Button'
import Selector from '../components/Selector'
import { ChamberToDisplay } from '../server/chambress'
import { trpc } from '../utils/trpc'
import { Chamber } from '@prisma/client'
import { NextPage } from 'next'
import { useState } from 'react'

const CHAMBERS: Chamber[] = ['HOUSE', 'SENATE']

const AssetPlayground: NextPage = () => {
  const [chamber, setChamber] = useState<Chamber>('HOUSE')
  const m = trpc.useMutation(['asset-playground.materialize-step-regex'], {
    onSuccess: (data) => {
      console.log(data)
    },
  })
  return (
    <div>
      <AdminHeader currentPage="asset-playground" />
      <div className="p-2 max-w-xl flex flex-col gap-4">
        <div>
          <Selector
            label="Chamber"
            value={chamber}
            options={CHAMBERS}
            onChange={setChamber}
            displayNames={ChamberToDisplay}
          />
        </div>
        <Button
          label="Materialize"
          onClick={() => {
            m.mutate({ chamber })
          }}
        />
      </div>
    </div>
  )
}

export default AssetPlayground
