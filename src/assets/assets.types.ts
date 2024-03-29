/* eslint-disable @typescript-eslint/no-explicit-any */
export interface EngineContext {
  emit: (event: unknown) => void
}
export type DataTypeOf<A> = A extends Asset<infer DataType, any, any, any>
  ? DataType
  : never
export type MetaDataTypeOf<A> = A extends Asset<
  any,
  any,
  any,
  infer MetaDataType
>
  ? MetaDataType
  : never
export type ArgsTypeOf<A> = A extends Asset<any, infer ArgsType, any, any>
  ? ArgsType
  : never
export type AnyAsset = Asset<any, any, any, any>
export type AssetArray = Array<AnyAsset>
export type DataTypesOf<T extends AssetArray> = {
  [K in keyof T]: DataTypeOf<T[K]>
}
export type MetaDataTypesOf<T extends AssetArray> = {
  [K in keyof T]: MetaDataTypeOf<T[K]>
}
export type Asset<T, A extends Array<unknown>, D extends Array<AnyAsset>, M> = {
  name: string
  queue: JobQueueName
  deps: D
  // true => skip create, false => run create
  policy: (
    ...args: A
  ) => <DD extends DataTypesOf<D>>(...depsData: DD) => Promise<boolean>
  read: (...args: A) => Promise<T>
  create: (
    ctx: EngineContext,
  ) => (
    ...args: A
  ) => <DD extends DataTypesOf<D>>(...depsData: DD) => Promise<void>
  readMetadata?: (
    ...args: A
  ) => Promise<M | null>
}

export type JobID = number
export type JobQueueName = 'local-asset-queue' | 'congress-api-asset-queue'
export function isQueueName(name: string): name is JobQueueName {
  return name === 'local-asset-queue' || name === 'congress-api-asset-queue'
}
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
