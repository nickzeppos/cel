import { trpc } from '../utils/trpc'
import {
  detectOverflow,
  useClientPoint,
  useFloating,
  useHover,
  useInteractions,
} from '@floating-ui/react'
import { Chamber } from '@prisma/client'
import clsx from 'clsx'
import { useRef, useState } from 'react'

interface Props {
  chamber: Chamber
  congress: number
}
export default function BillsAssetCard({ chamber, congress }: Props) {
  const assetState = trpc.useQuery([
    'asset-playground.get-bills-asset-state',
    { chamber, congress },
  ])

  const pageCount = assetState.data?.pageStatuses.length ?? 'unknown'
  const pageStatuses = assetState.data?.pageStatuses ?? []
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
        {pageStatuses.map(({ file, status }) => (
          <FileStatus
            key={file}
            file={file}
            status={status}
            onHover={() =>
              setHoverItems((current) => new Set(current).add(file))
            }
            onUnhover={() =>
              setHoverItems((current) => {
                const next = new Set(current)
                next.delete(file)
                return next
              })
            }
            isFaded={hoverItems.size > 0 && !hoverItems.has(file)}
          />
        ))}
      </div>
    </div>
  )
}

function getColor(status: string) {
  switch (status) {
    case 'complete':
      return 'bg-green-600'
    case 'incomplete':
      return 'bg-red-600'
    case 'fetching':
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
  status: string
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
