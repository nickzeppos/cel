import { NextPage } from 'next'
import AdminHeader from '../components/AdminHeader'
import Button from '../components/Button'
import { trpc } from '../utils/trpc'
import { formatDuration, formatRelative } from 'date-fns'
import { useIntervalWhen } from 'rooks'
import {
  TrashIcon,
  PlayCircleIcon,
  StopCircleIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'
import {
  TrashIcon as TrashIconSolid,
  PlusCircleIcon as PlusCircleIconSolid,
  PlayCircleIcon as PlayCircleIconSolid,
  PauseCircleIcon as PauseCircleIconSolid,
  ArrowPathIcon,
} from '@heroicons/react/24/solid'
import { Transition } from '@headlessui/react'
import React, { useRef, useState } from 'react'

const Jobs: NextPage = () => {
  const [didFetch, setDidFetch] = useState(false)
  const fetchTimeoutRef = useRef<number | null>(null)
  const queueState = trpc.useQuery(['queue-state'], {
    onSuccess() {
      if (fetchTimeoutRef.current != null) {
        window.clearInterval(fetchTimeoutRef.current)
        fetchTimeoutRef.current = null
      }
      setDidFetch(false)
      window.setTimeout(() => {
        setDidFetch(true)
      }, 0)
    },
    refetchOnWindowFocus: false,
  })
  const m = trpc.useMutation(['queue-job'], {
    onSuccess() {
      queueState.refetch()
    },
  })
  const m2 = trpc.useMutation(['pause-queue'], {
    onSuccess() {
      queueState.refetch()
    },
  })
  const m3 = trpc.useMutation(['resume-queue'], {
    onSuccess() {
      queueState.refetch()
    },
  })
  const m4 = trpc.useMutation(['clean-queue'], {
    onSuccess() {
      queueState.refetch()
    },
  })
  const removeJobMutation = trpc.useMutation(['remove-job'], {
    onSuccess() {
      queueState.refetch()
    },
  })
  trpc.useSubscription(['on-queue-job'], {
    onNext(data) {
      console.log(`🎆 ${data.id}`)
    },
  })
  const isPaused = queueState.data?.isPaused ?? false
  const name = queueState.data?.name ?? ''
  const jobbies = queueState.data?.jobs ?? []
  // useIntervalWhen(
  //   () => {
  //     queueState.refetch()
  //   },
  //   5000,
  //   !isPaused,
  //   false,
  // )

  return (
    <div>
      <AdminHeader currentPage="jobs" />
      <div
        className={`m-4 rounded-t-xl border-4 ${
          isPaused ? 'border-red-400/60' : 'border-green-400/60'
        }`}
      >
        <div className="flex items-center gap-2 p-4 pb-0">
          <PlusCircleIconSolid
            className="h-8 w-8 cursor-pointer text-white"
            onClick={() => {
              m.mutate()
            }}
          />
          {isPaused ? (
            <PlayCircleIconSolid
              className="h-8 w-8 cursor-pointer text-white"
              onClick={() => {
                m3.mutate()
              }}
            />
          ) : (
            <PauseCircleIconSolid
              className="h-8 w-8 cursor-pointer text-white"
              onClick={() => {
                m2.mutate()
              }}
            />
          )}
          <ArrowPathIcon
            className="h-8 w-8 cursor-pointer text-white"
            onClick={() => {
              queueState.refetch()
            }}
          />

          <TrashIconSolid
            className="h-8 w-8 cursor-pointer text-white"
            onClick={() => {
              m4.mutate()
            }}
          />
          <div className="text-xl font-bold">
            {name} (
            {
              jobbies.filter(
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
              show={didFetch}
              afterEnter={() => {
                setDidFetch(false)
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
            {jobbies.map((j, i) => {
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
                  className={`flex w-[200px] flex-col divide-y divide-neutral-700 rounded-lg border border-neutral-600 shadow-md hover:shadow-neutral-600/70 ${
                    isPaused ? 'opacity-40' : ''
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
                          removeJobMutation.mutate({ id: j.id })
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
                      <div>{j.returnvalue?.message}</div>
                    ) : null}
                    {j.failedReason != null ? (
                      <div>{j.failedReason}</div>
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
