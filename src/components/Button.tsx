import { ButtonHTMLAttributes } from 'react'

interface Props {
  label: string
}

export default function Button({
  label,
  ...props
}: Props & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="bg-neutral-600 rounded-md p-2" {...props}>
      {label}
    </button>
  )
}
