import { NextPage } from 'next'
import Image from 'next/image'
import AdminHeader from '../components/AdminHeader'
import MemberTile from '../components/MemberTile'
import { trpc } from '../utils/trpc'

const Member: NextPage = () => {
  const q = trpc.useQuery(['get-members'])
  const m = trpc.useMutation(['create-members'], {
    onSuccess: (data) => {
      console.log(data)
    },
  })

  return (
    <div>
      <AdminHeader currentPage="member" />
      <div>
        <div className="p-4">
          <button
            className="bg-neutral-600 rounded-md p-2"
            disabled={m.isLoading}
            onClick={() => {
              m.mutate()
            }}
          >
            Create Members
          </button>
        </div>
        <div className="place-content-center p-2 grid grid-cols-[repeat(auto-fill,300px)] grid-rows-[repeat(auto-fill)] gap-2">
          {(q.data ?? []).map((member) => (
            <MemberTile member={member} key={member.bioguideId} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Member
