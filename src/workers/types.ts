import { z } from 'zod'

export interface TestJobData {
  color: string
  count: number
}
export interface TestJobResponse {
  message: string
}
export type TestJobName = 'test-job'

// export interface BillJobData {
//   congress: number
//   billType: string
//   billNum: number
// }

export const billJobDataValidator = z.object({
  congress: z.number().min(93),
  billType: z.enum(['hr', 's']),
  billNum: z.number(),
})

export type BillJobData = z.infer<typeof billJobDataValidator>

export interface BillJobResponse {
  message: string
}

export type BillJobName = 'bill-job'
