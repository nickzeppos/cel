import { NextPage } from 'next'
import Image from 'next/image'
import AdminHeader from '../components/AdminHeader'
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
        <button
          className="bg-neutral-600 rounded-md p-2"
          disabled={m.isLoading}
          onClick={() => {
            m.mutate()
          }}
        >
          Create Members
        </button>
        {(q.data ?? []).map((member) => (
          <div key={member.bioguideId}>
            <div>{member.name}</div>
            <div>
              {member.imageUrl && (
                <Image src={member.imageUrl} width={200} height={200} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Member
