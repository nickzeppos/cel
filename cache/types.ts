export type CacheConfig = {
  header: {
    date: Date
    script: string
  }
  bills: Array<{
    congress: number
    billType: BillType
    count: number
  }>
}

export type BillType = 'hr' | 's'
