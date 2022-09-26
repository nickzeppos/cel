import Link from 'next/link'

type Pages = 'chambress' | 'member'
interface Props {
  currentPage?: Pages
}

export default function AdminHeader({ currentPage }: Props) {
  return (
    <div className="flex gap-8 p-2 border-b border-neutral-600 items-center">
      <Link href="/">
        <a className="font-bold text-xl">CEL Admin</a>
      </Link>
      <div className="flex gap-4">
        <HeaderLink
          page="chambress"
          currentPage={currentPage}
          label="Chambress"
        />
        <HeaderLink page="member" currentPage={currentPage} label="Member" />
      </div>
    </div>
  )
}

interface HeaderLinkProps {
  page: Pages
  currentPage?: Pages
  label: string
}
function HeaderLink({ page, currentPage, label }: HeaderLinkProps) {
  return (
    <Link href={`/${page}`}>
      <a
        className={
          page === currentPage ? 'text-cyan-400 font-bold' : 'text-white'
        }
      >
        {label}
      </a>
    </Link>
  )
}
