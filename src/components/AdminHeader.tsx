import Link from 'next/link'

type Pages = 'chambress' | 'member' | 'jobs'
interface Props {
  currentPage?: Pages
}

export default function AdminHeader({ currentPage }: Props) {
  return (
    <div className="flex gap-8 py-2 px-4 border-b border-neutral-700 items-center">
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
        <HeaderLink page="jobs" currentPage={currentPage} label="Jobs" />
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
        className={`font-bold ${
          page === currentPage ? 'text-cyan-400' : 'text-white'
        }`}
      >
        {label}
      </a>
    </Link>
  )
}
