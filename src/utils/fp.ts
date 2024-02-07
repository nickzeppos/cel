import * as E from 'fp-ts/lib/Either'
import * as TE from 'fp-ts/lib/TaskEither'
import { Lazy } from 'fp-ts/lib/function'

export function errorIdentity(err: unknown): Error {
  return err instanceof Error ? err : new Error(`${err}`)
}

export function TETry<T>(f: Lazy<Promise<T>>) {
  return TE.tryCatch(f, errorIdentity)
}

export function ETry<T>(f: Lazy<T>) {
  return E.tryCatch(f, errorIdentity)
}

export const sleep = async (ms: number) =>
  await new Promise((resolve) => setTimeout(resolve, ms))
