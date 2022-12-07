export interface TestJobData {
  color: string
  count: number
}
export interface TestJobResponse {
  message: string
}
export type TestJobName = 'test-job'

export interface BillJobData {
  congress: number
  billType: string
  billNum: number
}

export interface BillJobResponse {
  message: string
}

export type BillJobName = 'bill-job'
