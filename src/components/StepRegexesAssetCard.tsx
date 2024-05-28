import { Chamber } from '@prisma/client'

interface Props {
  chamber: Chamber
}
export default function StepRegexesAssetCard({ chamber }: Props) {
  return (
    <div className="flex flex-col items-center w-full">
      <div className="text-4xl text-neutral-200">📜</div>
      <div className="text-sm text-neutral-500">Step Regexes for {chamber}</div>
    </div>
  )
}
