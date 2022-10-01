import { NextPage } from 'next'
import AdminHeader from '../components/AdminHeader'
import Button from '../components/Button'
import { trpc } from '../utils/trpc'

const Jobs: NextPage = () => {
  const m = trpc.useMutation(['queue-job'])
  const m2 = trpc.useMutation(['pause-queue'])
  const m3 = trpc.useMutation(['resume-queue'])
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
        <Button
          onClick={() => {
            m2.mutate()
          }}
          label="pause queue"
        />
        <Button
          onClick={() => {
            m3.mutate()
          }}
          label="resume queue"
        />
      </div>
    </div>
  )
}

export default Jobs
