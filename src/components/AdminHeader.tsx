import Link from 'next/link'

type Pages = 'chambress' | 'member' | 'jobs'
interface Props {
  currentPage?: Pages
}

export default function AdminHeader({ currentPage }: Props) {
  return (
    <div className="flex items-center gap-8 border-b border-neutral-700 py-2 px-4">
      <Link href="/">
        <a className="text-xl font-bold">CEL Admin</a>
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
  const textClasses = page === currentPage ? 'text-cyan-400' : 'text-white'
  return (
    <Link href={`/${page}`}>
      <a className={`font-bold ${textClasses}`}>{label}</a>
    </Link>
  )
}
