import { StoredAssetStatus } from '../assets/assets.validators'
import { trpc } from '../utils/trpc'
import {
  detectOverflow,
  useClientPoint,
  useFloating,
  useHover,
  useInteractions,
} from '@floating-ui/react'
import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'

interface Props {}
export default function AllMembersAssetCard({}: Props) {
  // initial state query
  const assetState = trpc.useQuery([
    'asset-playground.get-allMembers-asset-metadata',
  ])
  // state to store page statuses
  const [pageStatuses, setPageStatuses] = useState<
    Array<{ status: StoredAssetStatus; fileName: string; pageNumber: number }>
  >([])
  // use effect to set state provided by the query.success
  useEffect(() => {
    if (assetState.status == 'success') {
      setPageStatuses(assetState.data?.pageStatuses ?? [])
    }
  })
  // set up subscription to update pae statuses
  trpc.useSubscription(['asset-playground.allMembers-asset-progress'], {
    onNext: (data) => {
      setPageStatuses(data.pageStatuses)
    },
  })
  const boundaryRef = useRef<HTMLDivElement>(null)
  const [hoverItems, setHoverItems] = useState<Set<string>>(new Set())
  const passCount = useMemo(() => {
    return pageStatuses.filter((pageStatus) => pageStatus.status === 'PASS')
      .length
  }, [pageStatuses])
  if (assetState === undefined || assetState.data === undefined) {
    return (
      <div className="flex flex-col items-start w-full h-full gap-1 relative">
        <div className="flex flex-[2] items-end gap-2">
          <div className="text-4xl text-neutral-200"></div>
          <div className="text-sm text-neutral-500">Waiting on metadata...</div>
        </div>
      </div>
    )
  } else if (assetState.data === null) {
    return (
      <div className="flex flex-col items-start w-full h-full gap-1 relative">
        <div className="flex flex-[2] items-end gap-2">
          <div className="text-4xl text-neutral-200"></div>
          <div className="text-sm text-neutral-500">No metadata found</div>
        </div>
      </div>
    )
  } else {
    return (
      <div
        className="flex flex-col items-start w-full h-full gap-1 relative"
        ref={boundaryRef}
      >
        <div className="flex flex-[2] items-end gap-2">
          <div className="text-4xl text-neutral-200">{pageStatuses.length}</div>
          <div className="text-sm text-neutral-500">pages of bill metadata</div>
        </div>
        <div className="flex flex-1 w-full gap-[2px]">
          {pageStatuses.map(({ fileName, status }) => (
            <PageStatus
              key={fileName}
              file={fileName}
              status={status}
              onHover={() =>
                setHoverItems((current) => new Set(current).add(fileName))
              }
              onUnhover={() =>
                setHoverItems((current) => {
                  const next = new Set(current)
                  next.delete(fileName)
                  return next
                })
              }
              isFaded={hoverItems.size > 0 && !hoverItems.has(fileName)}
            />
          ))}
        </div>
      </div>
    )
  }
}

function PageStatus({
  file,
  status,
  isFaded,
  onHover,
  onUnhover,
}: {
  file: string
  status: StoredAssetStatus
  isFaded: boolean
  onHover: () => void
  onUnhover: () => void
}) {
  const [show, setShow] = useState(false)
  const { x, y, strategy, refs, context } = useFloating({
    open: show,
    onOpenChange: setShow,
    middleware: [
      {
        name: 'prevent overflow',
        fn: async (state) => {
          const overflow = await detectOverflow(state, {
            padding: 0,
            rootBoundary: 'viewport',
          })
          let newX = state.x
          if (overflow.right > 0) {
            newX -= overflow.right
          }
          if (overflow.left > 0) {
            newX += overflow.left
          }
          return {
            ...state,
            x: newX,
          }
        },
      },
    ],
  })
  const hover = useHover(context)
  const clientPoint = useClientPoint(context)
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    clientPoint,
  ])

  return (
    <>
      <div
        onMouseOver={onHover}
        onMouseOut={onUnhover}
        ref={refs.setReference}
        {...getReferenceProps()}
        className={clsx(
          isFaded ? 'opacity-20' : 'opacity-100',
          'w-full h-full hover:cursor-pointer',
          getColor(status),
        )}
      />
      {show && (
        <div
          className="bg-black p-1 rounded-md whitespace-nowrap overflow-hidden"
          style={{
            position: strategy,
            top: (y ?? 0) - 48,
            left: x ?? 0,
          }}
          ref={refs.setFloating}
          {...getFloatingProps()}
        >
          {file}
        </div>
      )}
    </>
  )
}

function getColor(status: StoredAssetStatus) {
  switch (status) {
    case 'PASS':
      return 'bg-green-600'
    case 'PENDING':
      return 'bg-red-600'
    case 'FETCHING':
      return 'bg-blue-600'
    default:
      return 'bg-neutral-600'
  }
}
