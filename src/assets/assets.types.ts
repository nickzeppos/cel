/* eslint-disable @typescript-eslint/no-explicit-any */
export type DataTypeOf<A> = A extends Asset<infer DataType, any, any>
  ? DataType
  : never
export type ArgsTypeOf<A> = A extends Asset<any, infer ArgsType, any>
  ? ArgsType
  : never
export type AnyAsset = Asset<any, any, any>
export type AssetArray = Array<AnyAsset>
export type DataTypesOf<T extends AssetArray> = {
  [K in keyof T]: DataTypeOf<T[K]>
}
export type AssetName = string
export type Asset<T, A extends Array<unknown>, D extends Array<AnyAsset>> = {
  name: AssetName
  queue: JobQueueName
  deps: D
  policy: (...args: A) => Promise<boolean>
  write: (...args: A) => (data: T) => Promise<void>
  read: (...args: A) => Promise<T>
  create: (
    ...args: A
  ) => <DD extends DataTypesOf<D>>(...depsData: DD) => Promise<T>
}

export type JobID = number
export type JobQueueName = 'local-asset-queue' | 'congress-api-asset-queue'
export type JobConfig = {
  id: JobID
  name: string
  queue: JobQueueName
  args: Array<unknown>
}
export type JobEdge = { job: JobID; dependsOn: JobID }
export type JobGraph = {
  jobs: JobConfig[]
  dependencies: JobEdge[]
}
