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
export type Asset<
  T,
  A extends Array<unknown>,
  D extends Array<Asset<any, any, any>>,
> = {
  name: AssetName
  queue: JobQueueName
  deps: D
  policy: (...deps: DataTypesOf<D>) => (...args: A) => Promise<boolean>
  write: (...args: A) => (data: T) => Promise<void>
  read: (...args: A) => Promise<T>
}

export type JobID = number
export type JobQueueName = 'local' | 'api'
export type JobConfig = {
  id: JobID
  name: string
  queue: JobQueueName
  args: Array<unknown>
}
export type JobGraph = {
  jobs: JobConfig[]
  dependencies: { job: JobID; dependsOn: JobID }[]
}
