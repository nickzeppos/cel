import AdminHeader from '../components/AdminHeader'
import { trpc } from '../utils/trpc'
import { Transition } from '@headlessui/react'
import {
  PlayCircleIcon,
  PlusCircleIcon,
  StopCircleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PauseCircleIcon as PauseCircleIconSolid,
  PlayCircleIcon as PlayCircleIconSolid,
  PlusCircleIcon as PlusCircleIconSolid,
  TrashIcon as TrashIconSolid,
} from '@heroicons/react/24/solid'
import { formatRelative } from 'date-fns'
import { NextPage } from 'next'
import React, { useRef, useState } from 'react'
import { useDebounce } from 'rooks'

const Jobs: NextPage = () => {
  const [congress, setCongress] = useState<number>(117)
  const [chamber, setChamber] = useState<string>('house')
  const [billNum, setBillNum] = useState<number>(1)

  const [didFetchTestQueueState, setDidFetchTestQueueState] = useState(false)
  const fetchTestTimeoutRef = useRef<number | null>(null)

  const [didFetchBillQueueState, setDidFetchBillQueueState] = useState(false)
  const fetchBillTimeoutRef = useRef<number | null>(null)

  const testQueueState = trpc.useQuery(['test-queue.state'], {
    onSuccess() {
      if (fetchTestTimeoutRef.current != null) {
        window.clearInterval(fetchTestTimeoutRef.current)
        fetchTestTimeoutRef.current = null
      }
      setDidFetchTestQueueState(false)
      window.setTimeout(() => {
        setDidFetchTestQueueState(true)
      }, 0)
    },
    refetchOnWindowFocus: false,
  })

  const billQueueState = trpc.useQuery(['bill-queue.state'], {
    onSuccess() {
      if (fetchBillTimeoutRef.current != null) {
        window.clearInterval(fetchBillTimeoutRef.current)
        fetchBillTimeoutRef.current = null
      }
      setDidFetchBillQueueState(false)
      window.setTimeout(() => {
        setDidFetchBillQueueState(true)
      }, 0)
    },
    refetchOnWindowFocus: false,
  })

  const debouncedTestRefetch = useDebounce(testQueueState.refetch, 100, {
    leading: true,
    trailing: true,
    maxWait: 500,
  })

  const debouncedBillRefetch = useDebounce(billQueueState.refetch, 100, {
    leading: true,
    trailing: true,
    maxWait: 500,
  })

  const pauseTestQueue = trpc.useMutation(['test-queue.pause'])
  const pauseBillQueue = trpc.useMutation(['bill-queue.pause'])

  const resumeTestQueue = trpc.useMutation(['test-queue.resume'])
  const resumeBillQueue = trpc.useMutation(['bill-queue.resume'])

  const addTestJob = trpc.useMutation(['test-queue.add-job'])
  const addBillJob = trpc.useMutation(['bill-queue.add-job'])

  const removeTestJob = trpc.useMutation(['test-queue.remove-job'])
  const removeBillJob = trpc.useMutation(['bill-queue.remove-job'])

  const cleanTestQueue = trpc.useMutation(['test-queue.clean'])
  const cleanBillQueue = trpc.useMutation(['bill-queue.clean'])

  trpc.useSubscription(['test-queue.on-change'], {
    onNext(data) {
      debouncedTestRefetch()
    },
  })

  trpc.useSubscription(['bill-queue.on-change'], {
    onNext(data) {
      debouncedBillRefetch()
    },
  })

  const isTestQueuePaused = testQueueState.data?.isPaused ?? false
  const isBillQueuePaused = billQueueState.data?.isPaused ?? false

  const testQueueName = testQueueState.data?.name ?? ''
  const billQueueName = billQueueState.data?.name ?? ''

  const testQueueJobbies = testQueueState.data?.jobs ?? []
  const billQueueJobbies = billQueueState.data?.jobs ?? []

  return (
    <div>
      <AdminHeader currentPage="jobs" />
      <div
        className={`m-4 rounded-t-xl border-4 ${
          isTestQueuePaused ? 'border-red-400/60' : 'border-green-400/60'
        }`}
      >
        <div className="flex items-center gap-2 p-4 pb-0">
          <PlusCircleIconSolid
            className="h-8 w-8 cursor-pointer text-white"
            onClick={() => {
              addTestJob.mutate()
            }}
          />
          {isTestQueuePaused ? (
            <PlayCircleIconSolid
              className="h-8 w-8 cursor-pointer text-white"
              onClick={() => {
                resumeTestQueue.mutate()
              }}
            />
          ) : (
            <PauseCircleIconSolid
              className="h-8 w-8 cursor-pointer text-white"
              onClick={() => {
                pauseTestQueue.mutate()
              }}
            />
          )}
          <ArrowPathIcon
            className="h-8 w-8 cursor-pointer text-white"
            onClick={() => {
              testQueueState.refetch()
            }}
          />

          <TrashIconSolid
            className="h-8 w-8 cursor-pointer text-white"
            onClick={() => {
              cleanTestQueue.mutate()
            }}
          />
          <div className="text-xl font-bold">
            {testQueueName} (
            {
              testQueueJobbies.filter(
                (j) =>
                  j.state === 'active' ||
                  j.state === 'delayed' ||
                  j.state === 'waiting',
              ).length
            }
            )
          </div>
          <div>
            <Transition
              as={React.Fragment}
              appear={true}
              show={didFetchTestQueueState}
              afterEnter={() => {
                setDidFetchTestQueueState(false)
              }}
              enter="transition ease-in-expo duration-100"
              enterFrom="opacity-0 scale-0"
              enterTo="opacity-100 scale-75"
              leave="transition ease-out-expo duration-1000"
              leaveFrom="opacity-100 scale-75"
              leaveTo="opacity-0 scale-150"
            >
              <div className="h-4 w-4 rounded-full bg-red-400" />
            </Transition>
          </div>
        </div>
        <div className={`relative flex overflow-x-scroll`}>
          <div className="flex flex-grow gap-4 p-4">
            {testQueueJobbies.map((j, i) => {
              const stateColor = (() => {
                switch (j.state) {
                  case 'active':
                    return 'text-blue-300 bg-blue-700/60'
                  case 'completed':
                    return 'text-green-300 bg-green-700/60'
                  case 'failed':
                    return 'text-red-300 bg-red-700/60'
                  default:
                    return 'text-neutral-300 bg-neutral-700/60'
                }
              })()
              return (
                <div
                  key={j.id ?? i}
                  className={`flex w-[220px] flex-col divide-y divide-neutral-700 rounded-lg border border-neutral-600 shadow-md hover:shadow-neutral-600/70 ${
                    isTestQueuePaused ? 'opacity-40' : ''
                  } hover:border-neutral-400 hover:opacity-100`}
                >
                  <div className="flex items-center justify-center gap-2 p-2">
                    <div className="font-bold text-neutral-300">
                      {j.id ?? ''}
                    </div>
                    <div
                      className={`rounded-sm px-2 py-0.5 text-xs ${stateColor}`}
                    >
                      {j.state}
                    </div>
                    <TrashIcon
                      className="ml-auto h-5 w-5 cursor-pointer select-none"
                      onClick={() => {
                        if (j.id != null) {
                          removeTestJob.mutate({ id: j.id })
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-col p-2 text-neutral-500">
                    <div className="flex items-center gap-2">
                      <PlusCircleIcon className="h-6 w-6" />
                      {formatRelative(j.timestamp, new Date())}
                    </div>
                    <div className="flex items-center gap-2">
                      <PlayCircleIcon className="h-6 w-6" />
                      {j.processedOn
                        ? formatRelative(j.processedOn, new Date())
                        : '-'}
                    </div>
                    <div className="flex items-center gap-2">
                      <StopCircleIcon className="h-6 w-6" />
                      {j.finishedOn
                        ? formatRelative(j.finishedOn, new Date())
                        : '-'}
                    </div>
                  </div>
                  <div className="flex flex-col p-2 text-neutral-300">
                    <div className="flex gap-2">
                      <span className="w-[60px] font-bold text-neutral-500">
                        color
                      </span>
                      <div>{j.data.color}</div>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-[60px] font-bold text-neutral-500">
                        count
                      </span>
                      <div>{j.data.count}</div>
                    </div>
                  </div>
                  <div className="flex-grow p-2">
                    {j.returnvalue != null ? (
                      <div>
                        <CheckCircleIcon className="mr-1 inline-block h-5 w-5 text-green-400" />
                        {j.returnvalue?.message}
                      </div>
                    ) : null}
                    {j.failedReason != null ? (
                      <div>
                        <ExclamationTriangleIcon className="mr-1 inline-block h-5 w-5 text-red-400" />
                        {j.failedReason}
                      </div>
                    ) : null}
                    {j.state === 'active' && (
                      <div className="grid h-full w-full place-items-center">
                        <svg
                          className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div
        className={`m-4 rounded-t-xl border-4 ${
          isBillQueuePaused ? 'border-red-400/60' : 'border-green-400/60'
        }`}
      >
        <div className="flex items-center gap-2 p-4 pb-0">
          <label className="ml-2">congress</label>
          <input
            id="congress"
            type="text"
            placeholder={`${congress}`}
            className="bg-neutral-900 text-neutral-100  border-b-2 outline-none rounded focus:border-blue-500"
            onChange={(e) => setCongress(parseInt(e.target.value))}
          />

          <label className="ml-2">chamber</label>
          <input
            id="chamber"
            type="text"
            placeholder={`${chamber}`}
            className="bg-neutral-900 text-neutral-100 border-b-2 rounded"
            onChange={(e) => setChamber(e.target.value)}
          />
          <label className="ml-2">billNum</label>
          <input
            id="chamber"
            type="text"
            placeholder={`${billNum}`}
            className="bg-neutral-900 text-neutral-100 border-b-2 rounded"
            onChange={(e) => setBillNum(parseInt(e.target.value))}
          />

          <PlusCircleIconSolid
            className="h-8 w-8 cursor-pointer text-white"
            onClick={() => {
              addBillJob.mutate({ billNum, congress, chamber })
            }}
          />
          {isBillQueuePaused ? (
            <PlayCircleIconSolid
              className="h-8 w-8 cursor-pointer text-white"
              onClick={() => {
                resumeBillQueue.mutate()
              }}
            />
          ) : (
            <PauseCircleIconSolid
              className="h-8 w-8 cursor-pointer text-white"
              onClick={() => {
                pauseBillQueue.mutate()
              }}
            />
          )}
          <ArrowPathIcon
            className="h-8 w-8 cursor-pointer text-white"
            onClick={() => {
              billQueueState.refetch()
            }}
          />

          <TrashIconSolid
            className="h-8 w-8 cursor-pointer text-white"
            onClick={() => {
              cleanBillQueue.mutate()
            }}
          />
          <div className="text-xl font-bold">
            {billQueueName} (
            {
              billQueueJobbies.filter(
                (j) =>
                  j.state === 'active' ||
                  j.state === 'delayed' ||
                  j.state === 'waiting',
              ).length
            }
            )
          </div>
          <div>
            <Transition
              as={React.Fragment}
              appear={true}
              show={didFetchBillQueueState}
              afterEnter={() => {
                setDidFetchBillQueueState(false)
              }}
              enter="transition ease-in-expo duration-100"
              enterFrom="opacity-0 scale-0"
              enterTo="opacity-100 scale-75"
              leave="transition ease-out-expo duration-1000"
              leaveFrom="opacity-100 scale-75"
              leaveTo="opacity-0 scale-150"
            >
              <div className="h-4 w-4 rounded-full bg-red-400" />
            </Transition>
          </div>
        </div>
        <div className={`relative flex overflow-x-scroll`}>
          <div className="flex flex-grow gap-4 p-4">
            {billQueueJobbies.map((j, i) => {
              const stateColor = (() => {
                switch (j.state) {
                  case 'active':
                    return 'text-blue-300 bg-blue-700/60'
                  case 'completed':
                    return 'text-green-300 bg-green-700/60'
                  case 'failed':
                    return 'text-red-300 bg-red-700/60'
                  default:
                    return 'text-neutral-300 bg-neutral-700/60'
                }
              })()
              return (
                <div
                  key={j.id ?? i}
                  className={`flex w-[220px] flex-col divide-y divide-neutral-700 rounded-lg border border-neutral-600 shadow-md hover:shadow-neutral-600/70 ${
                    isTestQueuePaused ? 'opacity-40' : ''
                  } hover:border-neutral-400 hover:opacity-100`}
                >
                  <div className="flex items-center justify-center gap-2 p-2">
                    <div className="font-bold text-neutral-300">
                      {j.id ?? ''}
                    </div>
                    <div
                      className={`rounded-sm px-2 py-0.5 text-xs ${stateColor}`}
                    >
                      {j.state}
                    </div>
                    <TrashIcon
                      className="ml-auto h-5 w-5 cursor-pointer select-none"
                      onClick={() => {
                        if (j.id != null) {
                          removeBillJob.mutate({ id: j.id })
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-col p-2 text-neutral-500">
                    <div className="flex items-center gap-2">
                      <PlusCircleIcon className="h-6 w-6" />
                      {formatRelative(j.timestamp, new Date())}
                    </div>
                    <div className="flex items-center gap-2">
                      <PlayCircleIcon className="h-6 w-6" />
                      {j.processedOn
                        ? formatRelative(j.processedOn, new Date())
                        : '-'}
                    </div>
                    <div className="flex items-center gap-2">
                      <StopCircleIcon className="h-6 w-6" />
                      {j.finishedOn
                        ? formatRelative(j.finishedOn, new Date())
                        : '-'}
                    </div>
                  </div>
                  <div className="flex flex-col p-2 text-neutral-300">
                    <div className="flex gap-2">
                      <span className="w-[60px] font-bold text-neutral-500">
                        congress
                      </span>
                      <div>{j.data.congress}</div>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-[60px] font-bold text-neutral-500">
                        chamber
                      </span>
                      <div>{j.data.chamber}</div>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-[60px] font-bold text-neutral-500">
                        billNum
                      </span>
                      <div>{j.data.billNum}</div>
                    </div>
                  </div>
                  <div className="flex-grow p-2">
                    {j.returnvalue != null ? (
                      <div>
                        <CheckCircleIcon className="mr-1 inline-block h-5 w-5 text-green-400" />
                        {j.returnvalue?.message}
                      </div>
                    ) : null}
                    {j.failedReason != null ? (
                      <div>
                        <ExclamationTriangleIcon className="mr-1 inline-block h-5 w-5 text-red-400" />
                        {j.failedReason}
                      </div>
                    ) : null}
                    {j.state === 'active' && (
                      <div className="grid h-full w-full place-items-center">
                        <svg
                          className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Jobs
