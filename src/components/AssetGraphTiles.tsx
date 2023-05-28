import { Chamber } from '.prisma/client'
import { JobState } from 'bullmq'
import clsx from 'clsx'
import { DependencyList, useEffect, useRef } from 'react'
import { AssetName } from '../assets/assetDefinitions'
import BillsListAssetCard from './BillAssetCard'
import BillsCountAssetCard from './BillsCountAssetCard'
import BillsAssetCard from './BillsListAssetCard'

export type AssetJobSummaryMap = Record<AssetName, AssetJobSummary>

export interface AssetJobSummary {
  name: AssetName
  state: JobState | 'unknown'
  childJobName: AssetName | null
}

export function getAssetJobSummary(name: AssetName): AssetJobSummary {
  return {
    name,
    state: 'unknown',
    childJobName: null,
  }
}

interface AssetGraphTilesProps {
  states?: AssetJobSummaryMap
  chamber?: Chamber
  congress?: number
}
export default function AssetGraphTiles({
  states,
  chamber,
  congress,
}: AssetGraphTilesProps) {
  return (
    <div className="flex flex-col p-4 m-4 border rounded-md border-gray-800">
      <div className="text-2xl font-bold ">Jobs</div>
      <div className="grid grid-cols-3 grid-rows-4 gap-4">
        <AssetGraphTile />
        <AssetGraphTile name="report" state={states?.['report']} />
        <AssetGraphTile />
        <AssetGraphTile name="bioguides" state={states?.['bioguides']} />
        <AssetGraphTile name="bill" state={states?.['bill']} >
          {chamber != null && congress != null ? (
            <BillsListAssetCard chamber={chamber} congress={congress} />
          ) : null}
        </AssetGraphTile>
        <AssetGraphTile name="billList" state={states?.['billList']}>
          {chamber != null && congress != null ? (
            <BillsAssetCard chamber={chamber} congress={congress} />
          ) : null}
        </AssetGraphTile>
        <AssetGraphTile name="members" state={states?.['members']} />
        <AssetGraphTile />
        <AssetGraphTile />
        <AssetGraphTile name="membersCount" state={states?.['membersCount']} />
        <AssetGraphTile name="billsCount" state={states?.['billsCount']}>
          {chamber != null && congress != null ? (
            <BillsCountAssetCard chamber={chamber} congress={congress} />
          ) : null}
        </AssetGraphTile>
        <AssetGraphTile />
      </div>
    </div>
  )
}

function useAnimation(
  el: HTMLElement | undefined | null,
  name: string,
  duration: number,
  deps?: DependencyList | undefined,
) {
  useEffect(() => {
    if (el == null) return
    el.classList.add(name)
    setTimeout(() => {
      el.classList.remove(name)
    }, duration)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

interface AssetGraphTileProps {
  name?: AssetName
  state?: AssetJobSummary
  children?: React.ReactNode
}
function AssetGraphTile({ name, state, children }: AssetGraphTileProps) {
  const isNotEmpty = name !== undefined && state != null
  const ref = useRef<HTMLDivElement>(null)
  useAnimation(ref.current, 'animate-flashBorder', 500, [state?.state])

  return (
    <div
      ref={ref}
      className={clsx(
        isNotEmpty && 'border-gray-700 border',
        'rounded-md p-2 min-h-[120px] flex flex-col',
      )}
    >
      {isNotEmpty && (
        <>
          <div className="flex justify-between">
            <h3
              className={clsx(
                'text-md font-medium',
                getTextColorForState(state?.state),
              )}
            >
              {name}
            </h3>
            <div className="flex gap-1 items-center">
              <div
                className={clsx('text-sm', getTextColorForState(state?.state))}
              >
                {state?.state}
              </div>
              <div
                className={clsx('text-sm', getTextColorForState(state?.state))}
              >
                {state?.childJobName}
              </div>
              <div
                className={clsx(
                  'w-3 h-3 rounded-full',
                  getColorForState(state?.state),
                )}
              />
            </div>
          </div>
          {children}
        </>
      )}
    </div>
  )
}

function getTextColorForState(state: JobState | 'unknown') {
  switch (state) {
    case 'unknown':
      return 'text-gray-500'
    default:
      return 'text-white'
  }
}

function getColorForState(state: JobState | 'unknown') {
  switch (state) {
    case 'completed':
      return 'bg-green-500'
    case 'failed':
      return 'bg-red-500'
    case 'delayed':
      return 'bg-yellow-500'
    case 'waiting':
    case 'waiting-children':
      return 'bg-purple-500'
    case 'active':
      return 'bg-blue-500'
    case 'unknown':
      return 'bg-gray-500'
  }
}
