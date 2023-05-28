import { Chamber } from '.prisma/client'
import {
  detectOverflow,
  useClientPoint,
  useFloating,
  useHover,
  useInteractions,
} from '@floating-ui/react'
import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { trpc } from '../utils/trpc'
import { StoredAssetStatus } from '../workers/types'

// duplicate from billsList.asset.ts
// to avoid depending on workers folder
const storedAssetStatusValidator = z.enum(['PENDING', 'PASS', 'FAIL', 'FETCHING'])
const pageStatusValidator = z.object({
  pageNumber: z.number(),
  filename: z.string(),
  status: storedAssetStatusValidator,
})
type PageStatus = z.infer<typeof pageStatusValidator>

interface Props {
  chamber: Chamber
  congress: number
}
export default function BillsListAssetCard({ chamber, congress }: Props) {
  const assetState = trpc.useQuery([
    'asset-playground.get-bills-asset-state',
    { chamber, congress },
  ])
  const pageCount = assetState.data?.pageStatuses?.length ?? 'unknown'
  const [pageStatuses, setPageStatuses] = useState<PageStatus[]>([])
  useEffect(() => {
    setPageStatuses(assetState.data?.pageStatuses ?? [])
  }, [assetState.data?.pageStatuses])
  trpc.useSubscription(['asset-playground.bills-asset-progress'], {
    onNext: (data) => {
      console.log('bills asset updated', data)
      if (typeof data !== 'object' || data == null || !('type' in data)) {
        console.warn('unknown subscription event', data)
        return
      }
      switch (data.type) {
        case 'billsAssetAllPagesStatus':
          const pageStatuses = z
            .object({
              pageStatuses: z.array(pageStatusValidator),
            })
            .safeParse(data)
          if (!pageStatuses.success) {
            console.error('invalid data', pageStatuses.error)
            return
          }
          setPageStatuses(pageStatuses.data?.pageStatuses ?? [])
          break
        case 'billsAssetPageStatus':
          const pageStatus = pageStatusValidator.safeParse(data)
          if (!pageStatus.success) {
            console.error('invalid data', pageStatus.error)
            return
          }
          const newPageStatus = pageStatus.data
          setPageStatuses((current) =>
            current.map((existingPageStatus) =>
              existingPageStatus.filename === newPageStatus.filename
                ? {
                  ...existingPageStatus, status: newPageStatus.status,
                }
                : existingPageStatus,
            ),
          )
          break
        default:
          console.warn('unknown subscription event', data)
      }
    },
  })
  const boundaryRef = useRef<HTMLDivElement>(null)
  const [hoverItems, setHoverItems] = useState<Set<string>>(new Set())

  return (
    <div
      className="flex flex-col items-start w-full h-full gap-1 relative"
      ref={boundaryRef}
    >
      <div className="flex flex-[2] items-end gap-2">
        <div className="text-4xl text-neutral-200">{pageCount}</div>
        <div className="text-sm text-neutral-500">pages of bill metadata</div>
      </div>
      <div className="flex flex-1 w-full gap-[2px]">
        {pageStatuses.map(({ filename, status }) => (
          <FileStatus
            key={filename}
            file={filename}
            status={status}
            onHover={() =>
              setHoverItems((current) => new Set(current).add(filename))
            }
            onUnhover={() =>
              setHoverItems((current) => {
                const next = new Set(current)
                next.delete(filename)
                return next
              })
            }
            isFaded={hoverItems.size > 0 && !hoverItems.has(filename)}
          />
        ))}
      </div>
    </div>
  )
}

function getColor(status: StoredAssetStatus) {
  switch (status) {
    case 'PASS':
      return 'bg-green-600'
    case 'FAIL':
      return 'bg-red-600'
    case 'FETCHING':
      return 'bg-blue-600'
    default:
      return 'bg-neutral-600'
  }
}

function FileStatus({
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
