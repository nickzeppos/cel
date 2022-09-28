import { NextPage } from 'next'
import AdminHeader from '../components/AdminHeader'
import Button from '../components/Button'
import { trpc } from '../utils/trpc'

const Jobs: NextPage = () => {
  const m = trpc.useMutation(['queue-job'])
  return (
    <div>
      <AdminHeader currentPage="jobs" />
      <div>
        <Button
          onClick={() => {
            m.mutate()
          }}
          label="queue job"
        />
      </div>
    </div>
  )
}

export default Jobs
