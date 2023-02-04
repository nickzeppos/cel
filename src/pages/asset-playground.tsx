import AdminHeader from '../components/AdminHeader'
import Button from '../components/Button'
import Selector from '../components/Selector'
import { ChamberToDisplay } from '../server/chambress'
import { trpc } from '../utils/trpc'
import { stepRegexesValidator } from '../workers/validators'
import { Chamber, Step } from '@prisma/client'
import { NextPage } from 'next'
import { useState } from 'react'

const CHAMBERS: Chamber[] = ['HOUSE', 'SENATE']

const AssetPlayground: NextPage = () => {
  const [chamber, setChamber] = useState<Chamber>('HOUSE')
  const [regexes, setRegexes] = useState<Map<Step, RegExp[]>>(new Map())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const m = trpc.useMutation(['asset-playground.materialize-step-regex'], {
    onSuccess: (data) => {
      console.log(data)
    },
  })
  trpc.useSubscription(['asset-playground.on-change'], {
    onNext(data) {
      console.log('subscription updated', data)

      const { stepRegexes, error } = data
      if (error) {
        console.log('bad news 🐻s materializing the asset')
        setRegexes(new Map())
        setErrorMessage(error)
        return
      }

      if (stepRegexes == null) {
        console.log('👻 no data')
        return
      }

      const v = stepRegexesValidator.safeParse(new Map(JSON.parse(stepRegexes)))
      if (v.success) {
        setRegexes(
          new Map(
            [...v.data.entries()].map(([step, strings]) => [
              step,
              strings.map((string) => new RegExp(string)),
            ]),
          ),
        )
        setErrorMessage(null)
      } else {
        console.log('bad news 🐻s while parsing data', v.error)
      }
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
        <div>
          <div className="text-lg">Output</div>
          {errorMessage && <div className="text-red-700">{errorMessage}</div>}
          {[...regexes.entries()].map(([step, rexs]) => (
            <>
              <div className="text-md">{step}</div>
              <ul key={step}>
                {rexs.map((rex, i) => (
                  <li key={i}>{rex.source}</li>
                ))}
              </ul>
            </>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AssetPlayground
